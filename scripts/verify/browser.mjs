import assert from "node:assert/strict";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export async function ensureSmokeBuild(directory) {
    for (const file of ["index.html", "media/index.html", "pagefind/pagefind.js"]) {
        await access(path.join(directory, file)).catch(() => {
            throw new Error(`Missing built file ${file}. Run pnpm run build before smoke.`);
        });
    }
}

export async function createSmokeSession(baseUrl) {
    const directory = path.resolve("output/playwright/smoke/chromium");
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    const browser = await chromium.launch({
        headless: true,
        channel: process.env.SMOKE_BROWSER_CHANNEL,
    });
    try {
        const context = await browser.newContext({ colorScheme: "light" });
        context.setDefaultTimeout(15000);
        context.setDefaultNavigationTimeout(15000);
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        const page = await context.newPage();
        const errors = [];

        await context.route("**/*", (route) => {
            const request = route.request();
            if (new URL(request.url()).origin === baseUrl) return route.continue();
            if (request.resourceType() === "image") {
                return route.fulfill({ path: "public/assets/images/site/favicon-32.png" });
            }
            return route.abort();
        });
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        page.on("requestfailed", (request) => {
            const failure = request.failure()?.errorText ?? "";
            if (request.resourceType() === "image" && /ERR_ABORTED/i.test(failure)) return;
            errors.push(`${request.method()} ${request.url()} (${failure})`);
        });

        return {
            page,
            assertNoErrors() {
                assert.equal(errors.length, 0, errors.join("\n"));
            },
            async captureFailure(error) {
                await writeFile(
                    path.join(directory, "failure.log"),
                    `${error.stack ?? error}\n${errors.join("\n")}`,
                );
                await Promise.allSettled([
                    page.screenshot({ path: path.join(directory, "page.png"), timeout: 5000 }),
                    context.tracing.stop({ path: path.join(directory, "trace.zip") }),
                ]);
                console.error(`Smoke failure artifacts: ${directory}`);
            },
            async close({ failed }) {
                await browser.close();
                if (!failed) await rm(directory, { recursive: true, force: true });
            },
        };
    } catch (error) {
        await browser.close();
        throw error;
    }
}
