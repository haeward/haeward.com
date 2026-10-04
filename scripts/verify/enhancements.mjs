import assert from "node:assert/strict";

const article = "/posts/2025/travelogue-of-southern-shanxi/";
export async function verifyEnhancements(browser, baseUrl) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("https://www.google.com/s2/favicons?*", (route) =>
        route.fulfill({
            path: "public/assets/images/site/favicon-32.png",
            contentType: "image/png",
        }),
    );
    const page = await context.newPage();
    for (const route of ["/", "/posts/"]) {
        await page.goto(baseUrl + route);
        const entry = page.locator("main ul li a").first();
        await entry.hover();
        assert.match(
            await entry
                .locator(":scope > div > div")
                .evaluate((node) => getComputedStyle(node).textDecorationLine),
            /underline/,
        );
        assert.equal(
            await entry
                .locator("time")
                .evaluate((node) => getComputedStyle(node).textDecorationLine),
            "none",
        );
    }
    await page.goto(baseUrl);
    await page.getByRole("link", { name: "All posts", exact: true }).click();
    await page.waitForURL("**/posts/");
    await page.waitForFunction(() => document.activeElement?.id === "main-content");
    await page.goto(baseUrl + article);
    const heading = page.locator(".blog-article h2[id]").first();
    const tocLink = page.locator(".blog-toc--desktop [data-toc-link='true']").first();
    assert.equal(await page.locator(".heading-anchor").count(), 0);
    await tocLink.click();
    assert(
        await heading.evaluate(
            (node) =>
                node.getBoundingClientRect().top >=
                document.querySelector("header").getBoundingClientRect().bottom,
        ),
    );
    assert.equal(await page.locator(".blog-toc--mobile summary").textContent(), "Contents");
    await page.locator("#search-trigger").click();
    assert.equal(
        await page
            .locator(".site-search__close")
            .textContent()
            .then((text) => text.trim()),
        "Close",
    );
    await page.locator("#site-search-input").fill("关帝");
    await page.waitForSelector('[data-search-state="results"]');
    assert.match(await page.locator("#site-search-summary").textContent(), /Showing/);
    // A new deployment must not be mixed into an already-loaded search instance.
    const original = await fetch(`${baseUrl}/pagefind/pagefind-entry.json`).then((response) =>
        response.json(),
    );
    await page.route("**/pagefind/pagefind-entry.json", (route) =>
        route.fulfill({ json: { ...original, version: "next-deployment" } }),
    );
    await page.locator("#site-search-input").fill("新的查询");
    await page.waitForSelector('[data-search-state="outdated"]');
    assert(await page.locator("#site-search a[data-astro-reload]").isVisible());
    assert.equal(await page.locator("[data-search-result-link]").count(), 0);
    await page.unroute("**/pagefind/pagefind-entry.json");
    let snapshotRequests = 0;
    await page.route("**/pagefind/pagefind-entry.json", (route) =>
        route.fulfill({
            json: ++snapshotRequests === 1 ? original : { ...original, version: "during-search" },
        }),
    );
    const nextSnapshot = page.waitForRequest("**/pagefind/pagefind-entry.json");
    await page.locator("#site-search-input").fill("Obsidian");
    await nextSnapshot;
    await page.waitForSelector('[data-search-state="outdated"]');
    assert(snapshotRequests >= 2);
    assert.equal(await page.locator("[data-search-result-link]").count(), 0);
    await page.unroute("**/pagefind/pagefind-entry.json");
    await page.keyboard.press("Escape");

    await page.goto(`${baseUrl}/links/#download-opml`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => scrollY >= 600);
    const scroll = await page.evaluate(() => scrollY);
    // The normal-flow header is offscreen. Avoid Playwright scrolling it into
    // view and replacing the history position that this check intends to test.
    await page.locator('header a[href="/about/"]').evaluate((link) => link.click());
    await page.waitForURL("**/about/");
    await page.waitForFunction(() => document.activeElement?.id === "main-content");
    await page.goBack();
    await page.waitForURL("**/links/#download-opml");
    await page.waitForFunction((y) => Math.abs(scrollY - y) < 12, scroll);
    await page.goForward();
    await page.waitForURL("**/about/");

    // Reflow widths equivalent to a 1280px desktop at 200% and 400% zoom;
    // actual browser zoom and real soft keyboards remain manual checks.
    for (const viewport of [
        { width: 640, height: 900 },
        { width: 320, height: 900 },
        { width: 844, height: 390 },
    ]) {
        await page.setViewportSize(viewport);
        for (const route of ["/", article, "/links/", "/about/", "/posts/"]) {
            await page.goto(baseUrl + route);
            assert(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                `Overflow at ${route}, ${viewport.width}px`,
            );
        }
        await page.locator("#search-trigger").click();
        const panel = await page.locator(".site-search__panel").boundingBox();
        assert(panel.y >= 0 && panel.y + panel.height <= viewport.height + 1);
        await page.keyboard.press("Escape");
    }
    await page.goto(baseUrl + article);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator(".blog-toc--mobile > summary").click();
    await page.locator("[data-toc-link='true']:visible").first().click();
    await page.waitForFunction(() => {
        const top = document.querySelector(".blog-article h2[id]").getBoundingClientRect().top;
        return top >= 0 && top < innerHeight;
    });

    // Slow response plus close/reopen must never display a dismissed query.
    await page.goto(baseUrl);
    await page.route("**/pagefind/pagefind-entry.json", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route.continue().catch(() => {});
    });
    await page.locator("#search-trigger").click();
    await page.locator("#site-search-input").fill("Obsidian");
    await page.waitForSelector('[data-search-state="loading"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.unroute("**/pagefind/pagefind-entry.json");
    await page.locator("#search-trigger").click();
    await page.locator("#site-search-input").fill("关帝");
    await page.waitForSelector('[data-search-state="results"]');
    assert.match(await page.locator("#site-search-summary").textContent(), /关帝/);
    await context.close();
}
