import assert from "node:assert/strict";

const movieGrid = '[data-tab-panel="movies"] [data-media-grid]';
const movieSentinel = '[data-tab-panel="movies"] [data-media-sentinel]';
const booksGrid = '[data-tab-panel="books"] [data-media-grid]';
const booksRetry = '[data-tab-panel="books"] [data-media-retry]';

async function withMediaPage(browser, baseUrl, label, verify) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
        const request = route.request();
        if (request.resourceType() === "image" && !request.url().startsWith(baseUrl)) {
            return route.fulfill({
                path: "public/assets/images/site/favicon-32.png",
                contentType: "image/png",
            });
        }
        return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
        await verify(page);
        assert.deepEqual(errors, [], label);
    } catch (error) {
        throw new Error(`${label}: ${error.message}`, { cause: error });
    } finally {
        await context.close();
    }
}

async function waitForMoviePage(page) {
    const expected = await page.locator("#media-data").evaluate((node) => {
        const manifest = JSON.parse(node.textContent);
        return Math.min(manifest.pageSize * 2, manifest.tabs.movies.count);
    });
    await page.locator(movieSentinel).scrollIntoViewIfNeeded();
    await page.waitForFunction(
        ({ selector, count }) => document.querySelector(selector)?.childElementCount === count,
        { selector: movieGrid, count: expected },
    );
}

export async function verifyMedia(browser, baseUrl) {
    await withMediaPage(browser, baseUrl, "Media history and keyboard", async (page) => {
        await page.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        await page
            .locator(`${movieGrid} img`)
            .first()
            .evaluate((image) => image.decode());
        const state = await page.evaluate(() => history.state);
        await page.locator('[data-tab="movies"]').focus();
        for (const [key, tab] of [
            ["ArrowRight", "series"],
            ["End", "books"],
            ["Home", "movies"],
            ["ArrowLeft", "books"],
            ["ArrowRight", "movies"],
        ]) {
            await page.keyboard.press(key);
            assert.equal(
                await page.evaluate(() => document.activeElement?.getAttribute("data-tab")),
                tab,
            );
            assert.equal(
                await page.locator('[data-tab][aria-selected="true"]').getAttribute("data-tab"),
                tab,
            );
            assert.equal(await page.locator('[data-tab][tabindex="0"]').count(), 1);
        }
        await page.locator('[data-tab="books"]').click();
        await page.waitForSelector(`${booksGrid} > li`);
        await page
            .locator(`${booksGrid} img`)
            .first()
            .evaluate((image) => image.decode());
        assert.equal(await page.evaluate(() => history.state?.index), state.index);
        await page.locator('header a[href="/about/"]').click();
        await page.waitForURL("**/about/");
        await page.waitForFunction(() => document.activeElement?.id === "main-content");
        await page.goBack();
        await page.waitForURL("**/media/#books");
        await page.locator("#media-tabs").waitFor({ state: "visible" });
        assert.equal(
            await page.locator('[data-tab][aria-selected="true"]').getAttribute("data-tab"),
            "books",
        );
        await page.waitForSelector(`${booksGrid} > li`);
        await page.goForward();
        await page.waitForURL("**/about/");
        await page
            .locator('header a[href="/about/"][aria-current="page"]')
            .waitFor({ state: "visible" });
        assert.equal(await page.locator("#media-tabs").count(), 0);
    });

    await withMediaPage(browser, baseUrl, "Media pagination retains focus", async (page) => {
        let release;
        const requested = new Promise((resolve) => {
            release = resolve;
        });
        await page.route("**/media/data/movies/2.json", (route) => release(route));
        await page.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        const card = page.locator(`${movieGrid} > li`).last().locator("a");
        const original = await card.elementHandle();
        await card.focus();
        await page.locator(movieSentinel).scrollIntoViewIfNeeded();
        const route = await requested;
        await route.continue();
        await waitForMoviePage(page);
        assert(
            await original.evaluate((node) => node.isConnected && document.activeElement === node),
            "Appending a page must retain the existing card and its keyboard focus.",
        );
        assert.equal(await page.locator(movieGrid).getAttribute("aria-busy"), "false");
    });

    await withMediaPage(browser, baseUrl, "Inactive media failure", async (page) => {
        let release;
        const requested = new Promise((resolve) => {
            release = resolve;
        });
        await page.route("**/media/data/books/1.json", (route) => release(route));
        await page.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        await page.locator('[data-tab="books"]').click();
        const route = await requested;
        assert.equal(await page.locator(booksGrid).getAttribute("aria-busy"), "true");
        await page.locator('[data-tab="movies"]').click();
        await route.fulfill({ status: 503, body: "Unavailable" });
        await page.waitForFunction(() =>
            document
                .querySelector('[data-tab-panel="books"] [data-media-status-message]')
                .textContent.includes("Could not load"),
        );
        await waitForMoviePage(page);
    });

    await withMediaPage(browser, baseUrl, "Media navigation request cancellation", async (page) => {
        let release;
        const requested = new Promise((resolve) => {
            release = resolve;
        });
        await page.route("**/media/data/books/1.json", (route) => release(route));
        await page.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        await page.locator('[data-tab="books"]').click();
        const route = await requested;
        await page.locator('header a[href="/about/"]').click();
        await page.waitForURL("**/about/");
        await page.waitForFunction(() => document.activeElement?.id === "main-content");
        await page.locator('header a[href="/media/"]').click();
        await page.waitForURL("**/media/");
        await page.waitForSelector(`${movieGrid} > li`);
        await route.fulfill({ status: 503, body: "Unavailable" }).catch(() => {});
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        await waitForMoviePage(page);
    });

    await withMediaPage(browser, baseUrl, "Media pagination retry", async (page) => {
        let attempts = 0;
        await page.route("**/media/data/movies/2.json", (route) =>
            ++attempts === 1
                ? route.fulfill({ status: 503, body: "Unavailable" })
                : route.continue(),
        );
        await page.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        const before = await page.locator(`${movieGrid} > li`).count();
        await page.locator(movieSentinel).scrollIntoViewIfNeeded();
        const retry = page.locator('[data-tab-panel="movies"] [data-media-retry]');
        await retry.waitFor({ state: "visible" });
        assert.equal(await page.locator(`${movieGrid} > li`).count(), before);
        assert.equal(await page.locator(movieGrid).getAttribute("aria-busy"), "false");
        const status = page.locator('[data-tab-panel="movies"] [data-media-status-message]');
        assert.equal(await status.getAttribute("role"), "status");
        assert.equal(await status.getAttribute("aria-live"), "polite");
        await retry.click();
        await waitForMoviePage(page);
        assert.equal(attempts, 2);
    });

    await withMediaPage(browser, baseUrl, "Media stalled request recovery", async (page) => {
        await page.route("**/media/data/books/1.json", () => {});
        await page.goto(`${baseUrl}/media/#books`, { waitUntil: "domcontentloaded" });
        await page.locator(booksRetry).waitFor({ state: "visible", timeout: 10000 });
        assert.equal(await page.locator(booksGrid).getAttribute("aria-busy"), "false");
        await page.unroute("**/media/data/books/1.json");
        await page.locator(booksRetry).click();
        await page.waitForSelector(`${booksGrid} > li`);
    });
}
