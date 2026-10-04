import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { gzipSync } from "node:zlib";

const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".xml": "application/xml; charset=utf-8",
    ".xsl": "application/xslt+xml; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
};
export async function startPreview(directory, { compress = false } = {}) {
    const root = path.resolve(directory);
    const cache = new Map();
    const server = http.createServer(async (req, res) => {
        if (!req.url) {
            res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Bad Request");
            return;
        }

        try {
            const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
            let file = path.resolve(root, `.${pathname}`);
            if (file !== root && !file.startsWith(root + path.sep)) throw new Error("Invalid path");
            if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
            const type = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
            const gzip =
                compress &&
                /gzip/.test(req.headers["accept-encoding"] || "") &&
                /^(text\/|application\/|font\/ttf)/.test(type);
            const key = file + gzip;
            if (!cache.has(key)) {
                const bytes = await readFile(file);
                cache.set(key, gzip ? gzipSync(bytes) : bytes);
            }
            res.setHeader("Content-Type", type);
            res.setHeader("Content-Length", cache.get(key).length);
            if (gzip) res.setHeader("Content-Encoding", "gzip");
            res.end(cache.get(key));
        } catch {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not Found");
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Unable to determine preview server address.");
    }
    return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}
