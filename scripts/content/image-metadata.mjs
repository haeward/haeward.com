import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

async function files(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return (
        await Promise.all(
            entries.map((entry) => {
                const file = path.join(dir, entry.name);
                return entry.isDirectory() ? files(file) : /\.mdx?$/.test(file) ? [file] : [];
            }),
        )
    ).flat();
}
const urls = new Set();
for (const file of await files("src/content/blog")) {
    const markdown = await readFile(file, "utf8");
    for (const match of markdown.matchAll(
        /!\[[^\]]*\]\((https:\/\/webp\.haeward\.com\/[^\s)]+|\/assets\/images\/posts\/[^\s)]+)\)/g,
    ))
        urls.add(match[1]);
}
const manifestPath = "src/data/article-images.json";
let previous = {};
try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
const result = {};
const localFiles = new Map();
const queue = [...urls].sort();
async function measure() {
    for (const url of queue.splice(0, 1)) {
        if (url.startsWith("/assets/images/posts/")) {
            const source = path.resolve("public", `.${decodeURIComponent(url)}`);
            const root = path.resolve("public/assets/images/posts") + path.sep;
            if (!source.startsWith(root)) throw new Error(`Invalid local image: ${url}`);
            // Decode the entire source: metadata alone cannot detect truncated images.
            const { data, info } = await sharp(source, { failOn: "warning" })
                .autoOrient()
                .raw()
                .toBuffer({ resolveWithObject: true });
            const widths = [...new Set([480, 768, 1024, 1440].map((w) => Math.min(w, info.width)))];
            const variants = [];
            for (const width of widths) {
                const filename = `${source.slice(0, -path.extname(source).length)}.w${width}.webp`;
                const output = await sharp(data, { raw: info })
                    .resize({ width })
                    .webp({ quality: 80 })
                    .toBuffer({ resolveWithObject: true });
                localFiles.set(filename, output.data);
                variants.push({
                    src: `/${path.relative("public", filename).split(path.sep).join("/")}`,
                    width: output.info.width,
                    height: output.info.height,
                });
            }
            result[url] = { width: info.width, height: info.height, variants };
            console.log(`${url}: prepared ${variants.length} local WebP variants`);
        } else if (previous[url]?.variants && !process.argv.includes("--refresh"))
            result[url] = previous[url];
        else {
            const variants = [];
            for (const requestWidth of [480, 768, 1024, 1440]) {
                const preview = new URL(url);
                preview.searchParams.set("width", String(requestWidth));
                const response = await fetch(preview, { signal: AbortSignal.timeout(20000) });
                if (!response.ok)
                    throw new Error(`Image request failed: ${response.status} ${url}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                const metadata = await sharp(buffer).metadata();
                await sharp(buffer, { failOn: "warning" }).raw().toBuffer();
                if (!metadata.width || !metadata.height)
                    throw new Error(`Missing dimensions: ${url}`);
                const rotated = [5, 6, 7, 8].includes(metadata.orientation);
                const width = rotated ? metadata.height : metadata.width;
                const height = rotated ? metadata.width : metadata.height;
                if (!variants.some((variant) => variant.width === width))
                    variants.push({ requestWidth, width, height });
            }
            variants.sort((a, b) => a.width - b.width);
            const largest = variants.at(-1);
            result[url] = { width: largest.width, height: largest.height, variants };
            console.log(`${new URL(url).pathname}: ${variants.map((v) => v.width).join(", ")}px`);
        }
        await measure();
    }
}
await Promise.all([measure(), measure(), measure()]);
const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
// Publish only after every request succeeds; never churn a partial manifest.
for (const [filename, bytes] of localFiles) await writeFile(filename, bytes);
await writeFile(manifestPath, `${JSON.stringify(sorted, null, 4)}\n`);
console.log(`Saved responsive variants for ${urls.size} images.`);
