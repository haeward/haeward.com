import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { startPreview } from "./server.mjs";

const workflow = await readFile(".github/workflows/deploy.yml", "utf8");
const version = workflow.match(/wranglerVersion:\s*["']([\d.]+)["']/)?.[1];
assert(version, "The deployment workflow must pin Wrangler.");
// Reserve an available port, then hand it to Wrangler's actual Pages emulator.
const { server, baseUrl } = await startPreview("dist");
await new Promise((resolve) => server.close(resolve));
const output = [];
const child = spawn(
    "pnpm",
    ["dlx", `wrangler@${version}`, "pages", "dev", "dist", "--port", new URL(baseUrl).port],
    {
        detached: process.platform !== "win32",
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
    },
);
let failure;
child.on("error", (error) => {
    failure = error;
});
child.on("exit", (code) => {
    failure = new Error(`Wrangler exited before validation finished (${code}).`);
});
for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (data) => output.push(data.toString()));
}

try {
    let ready = false;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        if (failure) throw failure;
        ready = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) })
            .then((response) => response.ok)
            .catch(() => false);
        if (ready) break;
        await setTimeout(100);
    }
    assert(ready, "Wrangler Pages did not start within 120 seconds.");
    const assets = await readdir("dist/_astro");
    const css = assets.find((file) => file.endsWith(".css"));
    assert(css, "The built site needs a CSS asset to verify immutable caching.");
    for (const route of [
        "/",
        "/about/",
        "/blogroll/",
        "/rss.xml",
        "/sitemap-index.xml",
        "/media/data/movies/1.json",
        "/pagefind/pagefind.js",
        `/_astro/${css}`,
    ]) {
        const response = await fetch(baseUrl + route, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200, route);
        assert.equal(
            response.headers.get("cache-control"),
            route.startsWith("/_astro/")
                ? "public, max-age=31536000, immutable"
                : "public, max-age=0, must-revalidate",
            route,
        );
    }
    for (const route of ["/links", "/links/"]) {
        const response = await fetch(baseUrl + route, {
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
        });
        assert.equal(response.status, 404, `${route} must be removed without a redirect.`);
    }
    console.log(`Wrangler ${version}: Pages startup and cache headers passed.`);
} catch (error) {
    await mkdir("output/ci", { recursive: true });
    await writeFile("output/ci/deploy.log", `${error.stack}\n${output.join("")}`);
    throw error;
} finally {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
        if (process.platform === "win32") child.kill();
        else {
            try {
                process.kill(-child.pid, "SIGTERM");
            } catch (error) {
                if (error.code !== "ESRCH") {
                    console.error(`Could not stop Wrangler: ${error.message}`);
                    process.exitCode = 1;
                }
            }
        }
    }
}
