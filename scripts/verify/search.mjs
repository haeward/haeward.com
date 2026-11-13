import assert from "node:assert/strict";

export async function verifySearch(browser, baseUrl) {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.goto(baseUrl);
        await page.locator("#search-trigger").click();
        await page.locator("#site-search-input").fill("Obsidian");
        const result = page.locator("[data-search-result-link]").first();
        await result.waitFor({ state: "visible" });
        const url = new URL(await result.getAttribute("href"), baseUrl);
        assert.equal(url.origin, new URL(baseUrl).origin);
        const response = await page.goto(url.href);
        assert.equal(response.status(), 200, "Real Pagefind result must resolve.");
    } finally {
        await context.close();
    }
}
