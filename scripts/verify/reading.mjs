import assert from "node:assert/strict";
import { createMarkdownProcessor, rehypeHeadingIds } from "@astrojs/markdown-remark";
import rehypeReading from "../../src/lib/rehype-reading.ts";
import remarkWorkQuote from "../../src/lib/remark-work-quote.ts";

const ARTICLE = "/posts/2025/travelogue-of-southern-shanxi/";

export async function verifyReading(browser, baseUrl) {
    const renderer = await createMarkdownProcessor({
        remarkPlugins: [remarkWorkQuote],
        rehypePlugins: [rehypeHeadingIds, [rehypeReading, { site: baseUrl }]],
    });
    const quoteFixture = await renderer.render(`
> [!QUOTE]
>
> First **passage**.\\
> Second line.
>
> Another paragraph.
>
> — Author [Work](https://example.com/work)

> Ordinary practical note.

> [!QUOTE]

> [!QUOTE]
>
> A quotation without attribution.

> [!QUOTE center]
>
> A centered poem.\\
> Its second line.
>
> — A poet
`);
    assert.equal((quoteFixture.code.match(/<figure class="literary-quote">/g) || []).length, 2);
    assert.match(quoteFixture.code, /<strong>passage<\/strong>/);
    assert.match(quoteFixture.code, /<br\s*\/?>(\n)?Second line/);
    assert.match(
        quoteFixture.code,
        /<figcaption>— Author <a[^>]*href="https:\/\/example.com\/work"/,
    );
    assert.match(quoteFixture.code, /<blockquote>\s*<p>Ordinary practical note\.<\/p>/);
    assert.match(quoteFixture.code, /<blockquote>\s*<p>\[!QUOTE\]<\/p>/);
    const linkFixture = await renderer.render(`
[Local](${baseUrl}/about/) [Relative](/about/) [Email](mailto:me@example.com)
[Wikipedia](https://zh.wikipedia.org/wiki/Test) [GitHub](//github.com/example)
[Lookalike](https://github.com.example.org/) [Other](https://example.com/)
[![Image](https://example.com/image.png)](https://example.com/image.png)
`);
    assert.equal((linkFixture.code.match(/class="prose-external-arrow"/g) || []).length, 4);
    assert.equal((linkFixture.code.match(/class="prose-site-mark"/g) || []).length, 0);
    assert(!/<a href="mailto:[^>]*data-external/.test(linkFixture.code));
    assert(
        !/<a href="https:\/\/github.com.example.org\/"[^>]*>\s*<span class="prose-site-mark"/.test(
            linkFixture.code,
        ),
    );
    const fixture = await renderer.render(
        "## Reading fixture\n\n| Device with a descriptive name | Cost | Date |\n| :--- | ---: | --- |\n| A device with enough words to wrap naturally | ¥12,345.00 | 2026-09-18 |\n\n```js\nconst message = 'A long code line ' + 'x'.repeat(150);\n```\n\n[Internal absolute link](" +
            baseUrl +
            "/about/) and [External link](https://example.com/).\n",
    );
    const articleHtml = await fetch(new URL(ARTICLE, baseUrl)).then((response) => response.text());
    const fixtureHtml = articleHtml.replace(
        /(<article\b[^>]*>)[\s\S]*?(<\/article>)/,
        `$1${fixture.code}${quoteFixture.code}$2`,
    );
    const fixtureUrl = `${baseUrl}/__reading-check/`;
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: "light",
    });
    await context.route(fixtureUrl, (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml }),
    );
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (text) => {
                    if (window.__copyFails) throw new Error("Clipboard blocked");
                    window.__copiedText = text;
                },
            },
        });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(fixtureUrl);
    // Use the explicit quotation fixture, not attribution counts in editable posts.
    assert.equal(await page.locator(".literary-quote figcaption").count(), 2);
    const centered = page.locator(".literary-quote--center");
    assert.equal(await centered.count(), 1);
    assert.equal(
        await centered.locator("p").evaluate((node) => getComputedStyle(node).textAlign),
        "center",
    );
    assert.equal(
        await centered.locator("figcaption").evaluate((node) => getComputedStyle(node).textAlign),
        "right",
    );
    for (const pseudo of ["::before", "::after"]) {
        assert.equal(
            await centered
                .locator("blockquote")
                .evaluate((node, pseudo) => getComputedStyle(node, pseudo).content, pseudo),
            "none",
        );
    }
    for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        const style = await page.locator('a[href="https://example.com/"]').evaluate((node) => {
            const css = getComputedStyle(node);
            return {
                color: css.color,
                parentColor: getComputedStyle(node.parentElement).color,
                weight: css.fontWeight,
                line: css.textDecorationLine,
                thickness: css.textDecorationThickness,
            };
        });
        assert.equal(style.color, style.parentColor);
        assert.equal(style.weight, "500");
        assert.equal(style.line, "underline");
        assert.equal(style.thickness, "1px");
    }
    await page.emulateMedia({ colorScheme: "light" });
    assert(
        await page
            .locator(".literary-quote")
            .first()
            .locator("blockquote > p")
            .nth(1)
            .evaluate((node) => Number.parseFloat(getComputedStyle(node).marginTop) >= 18),
        "Separate work-quote paragraphs must retain their spacing",
    );
    assert.equal(
        await page.locator('a[href="https://example.com/"] .prose-external-arrow').count(),
        1,
    );
    await page.locator(".code-wrap").click();
    assert.equal(
        await page.locator("pre").evaluate((node) => getComputedStyle(node).whiteSpace),
        "pre-wrap",
    );
    await page.locator(".code-wrap").click();
    assert.equal(
        await page.locator("pre").evaluate((node) => getComputedStyle(node).whiteSpace),
        "pre",
    );
    await page.locator(".code-copy").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => Boolean(window.__copiedText?.includes("const message")));
    await page.evaluate(() => {
        window.__copyFails = true;
    });
    await page.locator(".code-copy").click();
    assert.match(await page.locator(".code-copy__status").textContent(), /Could not copy/);
    assert.equal(await page.locator('a[href="https://example.com/"]').getAttribute("target"), null);
    assert.equal(
        await page.locator(`a[href="${baseUrl}/about/"]`).getAttribute("data-external"),
        "false",
    );
    assert.equal(await page.locator("th").first().getAttribute("scope"), "col");
    assert.equal(
        await page
            .locator("td")
            .nth(1)
            .evaluate((node) => getComputedStyle(node).textAlign),
        "right",
    );
    for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            `Page overflow at ${width}px`,
        );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${ARTICLE}#%E0%A4%A`);
    assert.equal(await page.locator("main h1").count(), 1);
    await page.locator(".blog-toc--mobile summary").click();
    assert(await page.locator(".blog-toc--mobile").evaluate((node) => node.open));
    await page.locator(".blog-toc--mobile a").first().click();
    assert(await page.evaluate(() => location.hash !== "#%E0%A4%A"));
    await page.locator("[data-image-zoom]").first().focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#image-lightbox").open);
    const source = await page.locator("[data-image-zoom]").first().getAttribute("href");
    assert.equal(await page.locator(".image-lightbox__original").getAttribute("href"), source);
    for (let index = 0; index < 6; index++) {
        await page.keyboard.press("Tab");
        assert(
            await page.evaluate(() =>
                document.querySelector("#image-lightbox").contains(document.activeElement),
            ),
        );
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.hasAttribute("data-image-zoom"));
    const imageCount = await page.locator(".blog-figure__image").count();
    assert.equal(imageCount, await page.locator(".blog-figure__image[width][height]").count());
    assert.equal(await page.locator(".literary-quote").count(), 3);
    assert.equal(await page.locator(".literary-quote--center").count(), 3);
    assert.equal(await page.locator(".prose-site-mark").count(), 0);
    assert.equal(
        await page
            .locator(".literary-quote p")
            .first()
            .evaluate((node) => getComputedStyle(node).textAlign),
        "center",
    );
    assert(!(await page.locator("article").innerText()).includes("[!QUOTE]"));
    assert.equal(await page.locator("[data-image-zoom] .prose-external-arrow").count(), 0);
    assert.equal(
        await page
            .locator(".literary-quote blockquote")
            .first()
            .evaluate((node) => getComputedStyle(node).borderLeftWidth),
        "0px",
    );
    assert(
        await page
            .locator(".blog-article > blockquote")
            .evaluate((node) => Number.parseFloat(getComputedStyle(node).borderLeftWidth) > 0),
    );

    await page.goto(baseUrl);
    // macOS WebKit defaults to controls-only navigation; Option-Tab includes links.
    const linkTab =
        browser.browserType().name() === "webkit" && process.platform === "darwin"
            ? "Alt+Tab"
            : "Tab";
    await page.keyboard.press(linkTab);
    assert.equal(await page.evaluate(() => document.activeElement?.className), "skip-link");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");
    await page.locator("#theme-toggle").click();
    await page.locator("#theme-toggle").click();
    assert.equal(await page.locator("html").getAttribute("data-theme-mode"), "light");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    assert.equal(await page.locator("html").getAttribute("data-theme-mode"), "light");
    await page.locator("#theme-toggle").click();
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));

    for (const theme of ["dark", "light"]) {
        if (theme === "light") await page.locator("#theme-toggle").click();
        assert.equal(await page.evaluate(() => localStorage.getItem("theme")), theme);
        const reopened = await browser.newContext({
            storageState: await context.storageState(),
            colorScheme: theme === "dark" ? "light" : "dark",
        });
        try {
            const reopenedPage = await reopened.newPage();
            await reopenedPage.goto(baseUrl);
            assert.equal(await reopenedPage.locator("html").getAttribute("data-theme-mode"), theme);
            assert.equal(
                await reopenedPage
                    .locator("html")
                    .evaluate((node) => node.classList.contains("dark")),
                theme === "dark",
            );
        } finally {
            await reopened.close();
        }
    }

    await page.route("**/pagefind/pagefind-entry.json", (route) =>
        route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await page.locator("#search-trigger").click();
    assert(await page.locator(".site-search__close").isVisible());
    await page.locator("#site-search-input").fill("Obsidian");
    await page.waitForSelector('[data-search-state="unavailable"]');
    assert(!/pnpm|dev mode/.test(await page.locator("#site-search-content").textContent()));
    await page.unroute("**/pagefind/pagefind-entry.json");
    await page.locator("[data-search-retry]").click();
    await page.waitForSelector('[data-search-state="results"]');
    await page.locator("#site-search-input").fill("");
    await page.locator("#site-search-input").dispatchEvent("compositionstart");
    await page.locator("#site-search-input").evaluate((input) => {
        input.value = "关帝";
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    });
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#site-search").getAttribute("data-search-state"), "idle");
    await page.locator("#site-search-input").dispatchEvent("compositionend");
    await page.waitForSelector('[data-search-state="results"]');
    for (let index = 0; index < 10; index++) {
        await page.keyboard.press("Tab");
        assert(
            await page.evaluate(() =>
                document.querySelector("#site-search").contains(document.activeElement),
            ),
        );
    }
    await page.locator(".site-search__close").click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "search-trigger");

    await page.locator('header a[href="/about/"]').click();
    await page.waitForURL("**/about/");
    assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
    assert.equal(
        await page
            .locator('header a[aria-current="page"]')
            .textContent()
            .then((text) => text.trim()),
        "About",
    );
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/");
    await page.locator("#search-trigger").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();

    const moduleFailure = await browser.newPage();
    await moduleFailure.route("**/pagefind/pagefind.js*", (route) =>
        route.fulfill({ status: 503, contentType: "text/javascript", body: "Unavailable" }),
    );
    await moduleFailure.goto(baseUrl);
    await moduleFailure.locator("#search-trigger").click();
    await moduleFailure.locator("#site-search-input").fill("Obsidian");
    await moduleFailure.waitForSelector('[data-search-state="unavailable"]');
    await moduleFailure.unroute("**/pagefind/pagefind.js*");
    await moduleFailure.locator("[data-search-retry]").click();
    await moduleFailure.waitForSelector('[data-search-state="results"]');
    await moduleFailure.close();

    const failures = await browser.newPage();
    await failures.route("**/pagefind/pagefind.js*", (route) =>
        route.fulfill({
            contentType: "text/javascript",
            body: `export async function search(term) {
                if (term === "timeout") return new Promise(() => {});
                if (term === "old") {
                    await fetch("/__search-old/");
                    return { results: [] };
                }
                const results = [{
                    data: async () => ({
                        url: "/posts/example/",
                        meta: { title: term === "partial" ? "Available result" : "Current result" },
                        excerpt: "<mark>Result</mark><img src=x onerror=alert(1)>",
                    }),
                }];
                if (term === "partial") results.push({
                    data: async () => { throw new Error("Missing fragment"); },
                });
                return { results };
            }`,
        }),
    );
    let notifyOldSearch;
    const oldSearchStarted = new Promise((resolve) => {
        notifyOldSearch = resolve;
    });
    await failures.route("**/__search-old/", (route) => notifyOldSearch(route));
    await failures.goto(baseUrl);
    await failures.locator("#search-trigger").click();
    await failures.locator("#site-search-input").fill("partial");
    await failures.waitForSelector('[data-search-state="results"]');
    assert.match(await failures.locator("#site-search-summary").textContent(), /Showing 1 of 2/);
    assert.equal(await failures.locator("#site-search-content img").count(), 0);
    await failures.locator("#site-search-input").fill("timeout");
    await failures.waitForSelector('[data-search-state="unavailable"]', { timeout: 12000 });
    await failures.locator("#site-search-input").fill("old");
    const oldSearchRoute = await oldSearchStarted;
    await failures.locator("#site-search-input").fill("new");
    await failures.waitForSelector('[data-search-state="results"]');
    await oldSearchRoute.fulfill({ status: 200, body: "" });
    await failures.waitForTimeout(50);
    assert.match(await failures.locator("#site-search-content").textContent(), /Current result/);
    await failures.close();

    // A deployment can change module URLs while the old document listeners remain.
    const deployment = await browser.newPage();
    await deployment.route("**/about/", async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
            /(src="[^"\s]*SearchModal[^"\s]*\.js)(")/g,
            "$1?deployment=next$2",
        );
        await route.fulfill({ response, body });
    });
    await deployment.goto(baseUrl);
    await deployment.locator("#search-trigger").click();
    await deployment.locator("#site-search-input").fill("Obsidian");
    await deployment.waitForSelector('[data-search-state="results"]');
    await deployment.keyboard.press("Escape");
    await deployment.locator('header a[href="/about/"]').click();
    await deployment.waitForURL("**/about/");
    await deployment.locator("#search-trigger").click();
    assert.equal(await deployment.locator("#site-search-input").inputValue(), "Obsidian");
    await deployment.close();

    const noJs = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 320, height: 720 },
    });
    await noJs.route(fixtureUrl, (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml }),
    );
    const staticPage = await noJs.newPage();
    await staticPage.goto(`${baseUrl}${ARTICLE}`);
    assert.equal(
        await staticPage.locator("article").evaluate((node) => getComputedStyle(node).opacity),
        "1",
    );
    await staticPage.locator(".blog-toc--mobile summary").click();
    assert(await staticPage.locator(".blog-toc--mobile a").first().isVisible());
    await staticPage.goto(fixtureUrl);
    assert(await staticPage.locator("table").isVisible());
    assert(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await staticPage.locator(".code-copy").count(), 0);
    assert.equal(await staticPage.locator("#search-trigger").isVisible(), false);
    await noJs.close();

    for (const blockRead of [true, false]) {
        const storage = await browser.newContext({ colorScheme: "light" });
        await storage.addInitScript((blockRead) => {
            if (blockRead)
                Storage.prototype.getItem = () => {
                    throw new DOMException("Blocked", "SecurityError");
                };
            Storage.prototype.setItem = () => {
                throw new DOMException("Blocked", "QuotaExceededError");
            };
        }, blockRead);
        const storagePage = await storage.newPage();
        const storageErrors = [];
        storagePage.on("pageerror", (error) => storageErrors.push(error.message));
        await storagePage.goto(baseUrl);
        await storagePage.locator("#theme-toggle").click();
        assert.equal(await storagePage.locator("html").getAttribute("data-theme-mode"), "dark");
        await storagePage.locator('header a[href="/about/"]').click();
        await storagePage.waitForURL("**/about/");
        assert.equal(await storagePage.locator("html").getAttribute("data-theme-mode"), "dark");
        assert.deepEqual(storageErrors, []);
        await storage.close();
    }
}
