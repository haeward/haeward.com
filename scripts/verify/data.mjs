import "./blogroll.mjs";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { portableRssContent } from "../../src/lib/rss-content.ts";
import { checkContent } from "./content.mjs";

const root = mkdtempSync(path.join(os.tmpdir(), "blog-data-check-"));
try {
    const portable = portableRssContent(
        '<p>Keep &amp; text</p><a href="../other/#part">Other</a><img src="/photo.png?x=1&amp;y=2" srcset="small.png 480w, //images.example.com/large.png 1024w"><a href="#part">Section</a>',
        new URL("https://example.com/posts/one/"),
    );
    const tree = fromHtml(portable, { fragment: true });
    const urls = [];
    visit(tree, "element", (node) => {
        if (node.properties.href) urls.push(node.properties.href);
        if (node.tagName === "img") {
            assert.equal(node.properties.src, "https://example.com/photo.png?x=1&y=2");
            assert.match(
                node.properties.srcSet,
                /https:\/\/example.com\/posts\/one\/small.png 480w/,
            );
        }
    });
    assert.deepEqual(urls, [
        "https://example.com/posts/other/#part",
        "https://example.com/posts/one/#part",
    ]);
    assert.match(portable, /Keep &#x26; text/);

    mkdirSync(path.join(root, "dist"));
    mkdirSync(path.join(root, "src/content/blog"), { recursive: true });
    writeFileSync(
        path.join(root, "dist/index.html"),
        '<link rel="canonical" href="https://example.com/"><a href="/missing/">Missing</a><a href="#absent">Absent</a><img src="/missing.png">',
    );
    for (const name of ["Same Name.md", "same-name.md"])
        writeFileSync(
            path.join(root, "src/content/blog", name),
            '---\ntitle: Test\ndate: "2025-02-31"\n---\nHello',
        );
    const errors = checkContent(root).join("\n");
    for (const expected of [
        /Duplicate slug/,
        /Invalid date/,
        /Missing local target/,
        /Missing anchor/,
        /lacks alt/,
    ])
        assert.match(errors, expected);
    console.log("RSS portability and content checker regressions passed.");
} finally {
    rmSync(root, { recursive: true, force: true });
}
