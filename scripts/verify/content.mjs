import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { slug } from "github-slugger";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

export function files(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}
export function checkContent(root = process.cwd()) {
    const errors = [];
    const report = (file, line, message) =>
        errors.push(`${path.relative(root, file)}:${line || 1}: ${message}`);
    const postFiles = new Map();
    const ids = new Map();
    const contentDir = path.join(root, "src/content/blog");
    for (const file of files(contentDir).filter((file) => /\.mdx?$/.test(file))) {
        const source = readFileSync(file, "utf8");
        try {
            const { frontmatter } = parseFrontmatter(source);
            const id =
                frontmatter.slug ||
                path
                    .relative(contentDir, file)
                    .replace(/\.mdx?$/, "")
                    .split(path.sep)
                    .map((segment) => slug(segment))
                    .join("/")
                    .replace(/\/index$/, "");
            if (
                typeof id !== "string" ||
                !id ||
                id.split("/").some((part) => !part || part === "." || part === "..") ||
                /[?#\\]/.test(id)
            )
                report(file, 1, "Invalid post slug");
            if (ids.has(id))
                report(
                    file,
                    1,
                    `Duplicate slug ${id}; also in ${path.relative(root, ids.get(id))}`,
                );
            ids.set(id, file);
            const date = new Date(frontmatter.date);
            const rawDate = /^date:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(source)?.[1];
            if (
                !rawDate ||
                !Number.isFinite(date.valueOf()) ||
                date.toISOString().slice(0, 10) !== rawDate
            )
                report(
                    file,
                    source.slice(0, source.indexOf("date:")).split("\n").length,
                    "Invalid date; use a real YYYY-MM-DD date",
                );
            if (!frontmatter.draft) postFiles.set(`/posts/${id}/`, file);
        } catch (error) {
            report(file, 1, error.message);
        }
    }
    const dist = path.join(root, "dist");
    const pages = new Map();
    for (const file of files(dist).filter((file) => file.endsWith(".html"))) {
        const route = `/${path.relative(dist, file).split(path.sep).join("/")}`.replace(
            /index\.html$/,
            "",
        );
        const tree = fromHtml(readFileSync(file, "utf8"));
        const elementIds = new Set();
        visit(tree, "element", (node) => {
            if (node.properties.id) elementIds.add(String(node.properties.id));
        });
        pages.set(route, { tree, file, ids: elementIds });
    }
    if (!pages.size) report(dist, 1, "Build the site before checking content");
    const home = pages.get("/");
    let origin;
    visit(home?.tree || { type: "root", children: [] }, "element", (node) => {
        if (node.tagName === "link" && node.properties.rel?.includes("canonical"))
            origin = new URL(String(node.properties.href)).origin;
    });
    origin ||= "https://example.invalid";
    for (const [route, page] of pages) {
        const articleImages = new Set();
        visit(page.tree, "element", (node) => {
            if (node.tagName === "article")
                visit(node, "element", (child) => {
                    if (child.tagName === "img") articleImages.add(child);
                });
        });
        const source = postFiles.get(route) || page.file;
        const sourceText = readFileSync(source, "utf8");
        const at = (value, message, line) => {
            const offset = sourceText.indexOf(value);
            report(
                source,
                source === page.file
                    ? line
                    : offset < 0
                      ? 1
                      : sourceText.slice(0, offset).split("\n").length,
                message,
            );
        };
        const checkUrl = (value, node) => {
            if (typeof value !== "string" || !value) return;
            let url;
            try {
                url = new URL(value, origin + route);
            } catch {
                at(value, `Invalid URL ${value}`, node.position?.start.line);
                return;
            }
            if (
                !["https:", "http:", "mailto:", "tel:", "data:"].includes(url.protocol) ||
                (url.protocol === "data:" && node.tagName !== "img")
            ) {
                at(value, `Unsupported URL protocol ${value}`, node.position?.start.line);
                return;
            }
            if (url.origin !== origin) return;
            let pathname;
            try {
                pathname = decodeURIComponent(url.pathname);
            } catch {
                at(value, `Malformed path ${value}`, node.position?.start.line);
                return;
            }
            const target = path.resolve(dist, `.${pathname}`);
            if (!target.startsWith(dist + path.sep) && target !== dist) {
                at(value, `Path outside site ${value}`, node.position?.start.line);
                return;
            }
            const targetRoute =
                pathname.endsWith("/") || path.extname(pathname) ? pathname : `${pathname}/`;
            const targetPage = pages.get(targetRoute);
            if (!targetPage && !existsSync(target))
                at(value, `Missing local target ${value}`, node.position?.start.line);
            if (targetPage && url.hash) {
                try {
                    if (!targetPage.ids.has(decodeURIComponent(url.hash.slice(1))))
                        at(value, `Missing anchor ${value}`, node.position?.start.line);
                } catch {
                    at(value, `Malformed anchor ${value}`, node.position?.start.line);
                }
            }
        };
        visit(page.tree, "element", (node, _index, parent) => {
            for (const key of ["href", "src", "poster"]) checkUrl(node.properties[key], node);
            if (
                typeof node.properties.srcSet === "string" &&
                !node.properties.srcSet.includes("data:")
            )
                for (const item of node.properties.srcSet.split(","))
                    checkUrl(item.trim().split(/\s+/)[0], node);
            if (node.tagName === "img") {
                const classes = node.properties.className || [];
                if (classes.includes("image-lightbox__img")) return; // populated only after opening a dialog
                if (!Object.hasOwn(node.properties, "alt"))
                    at(
                        String(node.properties.src),
                        "Image lacks alt attribute",
                        node.position?.start.line,
                    );
                if (
                    articleImages.has(node) &&
                    !(Number(node.properties.width) > 0 && Number(node.properties.height) > 0)
                )
                    at(
                        String(node.properties.src),
                        "Article image lacks positive dimensions",
                        node.position?.start.line,
                    );
                if (
                    classes.includes("blog-figure__image") &&
                    (!String(node.properties.alt || "").trim() ||
                        !Number(node.properties.width) ||
                        !Number(node.properties.height))
                )
                    at(
                        String(node.properties.src),
                        "Article image needs text alternative and dimensions",
                        node.position?.start.line,
                    );
                if (
                    parent?.tagName === "a" &&
                    !node.properties.alt &&
                    !parent.properties?.ariaLabel
                )
                    at(
                        String(node.properties.src),
                        "Linked image has no accessible label",
                        node.position?.start.line,
                    );
            }
        });
    }
    return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const errors = checkContent();
    if (errors.length) {
        console.error(errors.join("\n"));
        process.exitCode = 1;
    } else console.log("Content checks passed: routes, anchors, dates, slugs, and images.");
}
