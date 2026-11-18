import assert from "node:assert/strict";
import { createSmokeSession, ensureSmokeBuild } from "./browser.mjs";
import { startPreview } from "./server.mjs";

const article = "/posts/2025/travelogue-of-southern-shanxi/";

async function checkRoutes(baseUrl) {
    const routes = [
        ["/", 200],
        ["/about/", 200],
        ["/posts/", 200],
        [article, 200],
        ["/blogroll/", 200],
        ["/subscriptions.opml", 200],
        ["/media/", 200],
        ["/rss.xml", 200],
        ["/robots.txt", 200],
        ["/sitemap-index.xml", 200],
        ["/does-not-exist/", 404],
    ];
    await Promise.all(
        routes.map(async ([route, status]) => {
            const response = await fetch(baseUrl + route, { signal: AbortSignal.timeout(5000) });
            await response.body?.cancel();
            assert.equal(response.status, status, route);
        }),
    );
}

async function checkHome(page, baseUrl) {
    await page.goto(baseUrl);
    await page.waitForFunction(() => document.documentElement.dataset.themeMode === "light");
    await page.locator("#theme-toggle").click();
    await page.waitForFunction(() => document.documentElement.dataset.themeMode === "dark");

    await page.locator("#search-trigger").click();
    await page.locator("#site-search-input").fill("Obsidian");
    const result = page.locator("[data-search-result-link]").first();
    await result.waitFor({ state: "visible" });
    const url = new URL(await result.getAttribute("href"), baseUrl);
    assert.equal(url.origin, new URL(baseUrl).origin);
    const response = await page.goto(url.href);
    assert.equal(response?.status(), 200, "Real Pagefind result must resolve.");
}

async function checkMedia(page, baseUrl) {
    await page.goto(`${baseUrl}/media/#books`);
    const tab = page.locator('[data-tab="movies"]');
    await tab.click();
    await page.waitForFunction(() => window.location.hash === "#movies");
    const { pageSize, tabs } = await page
        .locator("#media-data")
        .evaluate((node) => JSON.parse(node.textContent));
    const count = tabs.movies.count;
    const panel = page.locator('[data-tab-panel="movies"]');
    await panel.waitFor({ state: "visible" });
    const cards = panel.locator("[data-media-grid] > li");
    if (count > 0) await cards.nth(Math.min(count, pageSize) - 1).waitFor();
    if (count > pageSize) {
        await panel.evaluate((element) => {
            element.querySelector("[data-media-sentinel]")?.scrollIntoView();
        });
        await cards.nth(Math.min(count, pageSize * 2) - 1).waitFor();
    }
}

async function run() {
    await ensureSmokeBuild("dist");
    const { server, baseUrl } = await startPreview("dist");
    let session;
    let failed = false;

    try {
        await checkRoutes(baseUrl);
        session = await createSmokeSession(baseUrl);
        const { page } = session;
        await checkHome(page, baseUrl);

        await page.goto(`${baseUrl}/blogroll/`);
        await page.locator("[data-blogroll] li a").first().waitFor();
        await page.locator('a[download="subscriptions.opml"]').waitFor();

        await checkMedia(page, baseUrl);

        await page.goto(baseUrl + article);
        const lightbox = page.locator("#image-lightbox[open]");
        await page.locator(".blog-article img").first().click();
        await lightbox.waitFor();
        await page.keyboard.press("Escape");
        await lightbox.waitFor({ state: "hidden" });
        session.assertNoErrors();
    } catch (error) {
        failed = true;
        await session?.captureFailure(error).catch((captureError) => {
            console.error(`Could not capture smoke failure: ${captureError.message}`);
        });
        throw error;
    } finally {
        try {
            await session?.close({ failed });
        } finally {
            await new Promise((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve())),
            );
        }
    }
}

run().then(
    () => console.log("Smoke checks passed."),
    (error) => {
        console.error(error);
        process.exitCode = 1;
    },
);
