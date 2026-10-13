import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";

export function smokeBrowserName(value = process.env.SMOKE_BROWSER ?? "chromium") {
    if (value !== "chromium" && value !== "webkit") {
        throw new Error(`Unsupported SMOKE_BROWSER: ${value}. Use chromium or webkit.`);
    }
    return value;
}

export async function ensureSmokeBuild(directory) {
    for (const file of ["index.html", "media/index.html", "pagefind/pagefind.js"]) {
        await access(path.join(directory, file)).catch(() => {
            throw new Error(`Missing built file ${file}. Run pnpm run build before smoke:built.`);
        });
    }
}

export async function createSmokeSession(baseUrl) {
    const name = smokeBrowserName();
    const directory = path.resolve("output/playwright/smoke", name);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    const launched = await { chromium, webkit }[name].launch({ headless: true });
    const events = [];
    const contexts = new Set();
    let sequence = 0;

    async function newContext(options) {
        const context = await launched.newContext(options);
        contexts.add(context);
        context.smokeArtifactPrefix = path.join(directory, `context-${++sequence}`);
        context.setDefaultTimeout(15000);
        context.setDefaultNavigationTimeout(15000);
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        // Scenarios may override this route with specific success/failure fixtures.
        // Production output and local requests still use the real preview server.
        await context.route("**/*", (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.origin === new URL(baseUrl).origin) return route.continue();
            if (request.resourceType() === "image") {
                return route.fulfill({
                    path: "public/assets/images/site/favicon-32.png",
                    contentType: "image/png",
                });
            }
            if (request.resourceType() === "document") {
                return route.fulfill({ contentType: "text/html", body: "<!doctype html>" });
            }
            events.push(`Blocked external request: ${request.method()} ${request.url()}`);
            return route.abort();
        });
        context.on("page", (page) => {
            page.on("pageerror", (error) => events.push(`${page.url()}: ${error.message}`));
            page.on("console", (message) => {
                if (message.type() === "error") events.push(`${page.url()}: ${message.text()}`);
            });
        });
        const close = context.close.bind(context);
        context.close = async () => {
            if (!contexts.delete(context)) return;
            await context.tracing
                .stop({ path: `${context.smokeArtifactPrefix}.zip` })
                .catch((error) => events.push(`Trace capture failed: ${error.message}`));
            await close();
        };
        return context;
    }

    return {
        browser: {
            browserType: () => launched.browserType(),
            newContext,
            async newPage(options) {
                const context = await newContext(options);
                return context.newPage();
            },
        },
        async captureFailure(error) {
            await writeFile(
                path.join(directory, "failure.log"),
                `${error.stack ?? error}\n${events.join("\n")}\n`,
            );
            await Promise.allSettled(
                [...contexts].flatMap((context) =>
                    context.pages().map((page, index) =>
                        page.screenshot({
                            path: `${context.smokeArtifactPrefix}-page-${index}.png`,
                            timeout: 5000,
                        }),
                    ),
                ),
            );
            console.error(`Smoke failure artifacts: ${directory}`);
        },
        async close({ failed }) {
            try {
                await Promise.allSettled([...contexts].map((context) => context.close()));
            } finally {
                await launched.close();
                if (!failed) await rm(directory, { recursive: true, force: true });
            }
        },
    };
}
