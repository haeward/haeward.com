import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startPreview } from "./server.mjs";

const arg = (name, fallback) =>
    process.argv[process.argv.indexOf(name) + 1] && process.argv.includes(name)
        ? process.argv[process.argv.indexOf(name) + 1]
        : fallback;
const directory = arg("--site", "dist");
const output = arg("--out", "/tmp/blog-performance.json");
const trials = Number(arg("--trials", "3"));
if (!Number.isInteger(trials) || trials < 1) throw new Error("--trials must be a positive integer");
const { server, baseUrl } = await startPreview(directory, { compress: true });
const browser = await chromium.launch();
const samples = [];
try {
    for (const route of ["/", "/posts/2025/travelogue-of-southern-shanxi/", "/links/"]) {
        for (let trial = 1; trial <= trials; trial++) {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 1,
                reducedMotion: "reduce",
            });
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send("Network.enable");
            await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
            await cdp.send("Network.emulateNetworkConditions", {
                offline: false,
                latency: 150,
                downloadThroughput: 200000,
                uploadThroughput: 93750,
            });
            await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
            await cdp.send("Performance.enable");
            let bytes = 0;
            const scriptUrls = new Set();
            const fontUrls = new Set();
            page.on("request", (request) => {
                if (request.resourceType() === "script") scriptUrls.add(request.url());
                if (request.resourceType() === "font") fontUrls.add(request.url());
            });
            cdp.on("Network.loadingFinished", (event) => {
                bytes += event.encodedDataLength;
            });
            const failures = [];
            page.on("requestfailed", (request) =>
                failures.push({
                    url: request.url().replace(baseUrl, ""),
                    reason: request.failure()?.errorText,
                }),
            );
            await page.addInitScript(() => {
                window.__lab = { lcp: 0, cls: 0 };
                let session = 0,
                    start = 0,
                    previous = 0;
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) window.__lab.lcp = entry.startTime;
                }).observe({ type: "largest-contentful-paint", buffered: true });
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.hadRecentInput) continue;
                        if (entry.startTime - previous > 1000 || entry.startTime - start > 5000) {
                            session = 0;
                            start = entry.startTime;
                        }
                        session += entry.value;
                        previous = entry.startTime;
                        window.__lab.cls = Math.max(window.__lab.cls, session);
                    }
                }).observe({ type: "layout-shift", buffered: true });
            });
            await page.goto(baseUrl + route, { waitUntil: "load", timeout: 120000 });
            await page.evaluate(() =>
                Promise.race([
                    document.fonts.ready,
                    new Promise((resolve) => setTimeout(resolve, 60000)),
                ]),
            );
            await page.waitForTimeout(2000);
            const lab = await page.evaluate(() => ({
                ...window.__lab,
                fontsReady: document.fonts.status === "loaded",
                resources: performance
                    .getEntriesByType("resource")
                    .filter((entry) => entry.initiatorType === "script")
                    .map((entry) => ({
                        name: new URL(entry.name).pathname,
                        bytes: entry.encodedBodySize,
                    })),
                navigation: performance.getEntriesByType("navigation")[0].toJSON(),
            }));
            const metrics = Object.fromEntries(
                (await cdp.send("Performance.getMetrics")).metrics.map((item) => [
                    item.name,
                    item.value,
                ]),
            );
            const sample = {
                route,
                trial,
                lcpMs: Math.round(lab.lcp),
                cls: Number(lab.cls.toFixed(4)),
                transferredBytes: bytes,
                scriptBytes: lab.resources.reduce((total, item) => total + item.bytes, 0),
                scriptCount: scriptUrls.size,
                fontCount: fontUrls.size,
                scriptDurationMs: Math.round(metrics.ScriptDuration * 1000),
                fontsReady: lab.fontsReady,
                failures,
                scripts: lab.resources,
                domContentLoadedMs: Math.round(lab.navigation.domContentLoadedEventEnd),
            };
            samples.push(sample);
            console.log(JSON.stringify(sample));
            await context.close();
        }
    }
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(
        output,
        `${JSON.stringify(
            {
                recordedAt: new Date().toISOString(),
                label: arg("--label", "working tree"),
                browser: browser.version(),
                environment: {
                    viewport: "390x844",
                    dpr: 1,
                    cpuSlowdown: 4,
                    latencyMs: 150,
                    downloadBytesPerSecond: 200000,
                    uploadBytesPerSecond: 93750,
                    coldCache: true,
                    server: "localhost with gzip; remote image CDN live",
                    wait: "load + fonts ready (60s maximum) + 2s; no interaction",
                },
                samples,
            },
            null,
            4,
        )}\n`,
    );
} finally {
    await browser.close();
    server.close();
}
