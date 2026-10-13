import assert from "node:assert/strict";

export async function verifyResourceLinks(browser, baseUrl) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const resources = [];
    page.on("request", (request) => {
        const pathname = new URL(request.url()).pathname;
        if (["/rss.xml", "/subscriptions.opml"].includes(pathname)) resources.push(pathname);
    });
    try {
        for (const [pathname, selector] of [
            ["/", 'main a[href="/rss.xml"]'],
            ["/", 'footer a[href="/rss.xml"]'],
            ["/blogroll/", 'a[download="subscriptions.opml"]'],
        ]) {
            await page.goto(baseUrl + pathname, { waitUntil: "networkidle" });
            const link = page.locator(selector);
            await link.focus();
            await link.hover();
            await page.waitForTimeout(200);
        }
        assert.deepEqual(resources, [], "Focusing or hovering a resource link downloaded it");
    } finally {
        await context.close();
    }
    console.log("Resource links: RSS and OPML wait for explicit activation.");
}
