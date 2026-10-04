import assert from "node:assert/strict";

const moduleFixture = `export async function search(term) {
    await fetch("/__search-call/" + encodeURIComponent(term));
    return { results: Array.from({ length: 24 }, (_, index) => ({
        data: async () => {
            const response = await fetch("/__search-data/" + encodeURIComponent(term) + "/" + index);
            if (!response.ok) throw new Error("Fragment unavailable");
            return response.json();
        },
    })) };
}`;

export async function verifySearchPagination(browser, baseUrl) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const counts = { snapshots: 0, searches: 0, details: 0 };
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let version = "fixture-v1";
    let failPartial = true;
    let pauseNext = false;
    let notifyPaused;
    let changeVersion = false;
    const entry = () => ({ languages: { en: { page_count: 24 } }, version });
    const detail = (term, index) => ({
        url: term === "partial" && index === 2 ? "http://%invalid" : `/posts/result-${index}/`,
        meta: { title: `${term} ${index}` },
        excerpt: "<mark>Match</mark><img src=x onerror=alert(1)>",
    });
    const open = async (term) => {
        version = "fixture-v1";
        await page.goto(baseUrl);
        await page.locator("#search-trigger").click();
        await page.locator("#site-search-input").fill(term);
        await page.waitForSelector('[data-search-state="results"]');
    };
    const pausePagination = () => {
        pauseNext = true;
        return new Promise((resolve) => {
            notifyPaused = resolve;
        });
    };
    try {
        await page.route("**/pagefind/pagefind-entry.json", (route) => {
            counts.snapshots++;
            return route.fulfill({ json: entry() });
        });
        await page.route("**/pagefind/pagefind.js*", (route) =>
            route.fulfill({ contentType: "text/javascript", body: moduleFixture }),
        );
        await page.route("**/__search-call/*", (route) => {
            counts.searches++;
            return route.fulfill({ body: "" });
        });
        await page.route("**/__search-data/*/*", (route) => {
            counts.details++;
            const segments = new URL(route.request().url()).pathname.split("/");
            const index = Number(segments.pop());
            const term = decodeURIComponent(segments.pop());
            if (term === "partial" && index === 1 && failPartial) {
                failPartial = false;
                return route.fulfill({ status: 503, body: "Unavailable" });
            }
            if (index === 8 && pauseNext) {
                pauseNext = false;
                notifyPaused({ route, data: detail(term, index) });
                return;
            }
            if (index === 8 && changeVersion) {
                changeVersion = false;
                version = "fixture-v2";
            }
            return route.fulfill({ json: detail(term, index) });
        });

        await open("pagination");
        const first = await page.locator(".site-search__result").first().elementHandle();
        const stages = [{ shown: 8, ...counts }];
        for (const shown of [16, 24]) {
            await page.locator("[data-search-more]").focus();
            await page.keyboard.press("Enter");
            await page.waitForSelector('[data-search-state="results"]');
            assert.equal(await page.locator(".site-search__result").count(), shown);
            assert(
                await first.evaluate(
                    (node) => node === document.querySelector(".site-search__result"),
                ),
                "Pagination replaced an existing result node",
            );
            assert(
                await page.evaluate(() =>
                    document.querySelector("#site-search").contains(document.activeElement),
                ),
                "Keyboard pagination lost dialog focus",
            );
            assert.equal(
                await page.evaluate(() => document.activeElement?.getAttribute("href")),
                shown === 24 ? new URL("/posts/result-16/", baseUrl).href : null,
            );
            stages.push({ shown, ...counts });
        }
        assert.deepEqual(stages, [
            { shown: 8, snapshots: 3, searches: 1, details: 8 },
            { shown: 16, snapshots: 5, searches: 1, details: 16 },
            { shown: 24, snapshots: 7, searches: 1, details: 24 },
        ]);
        assert.equal(await page.locator("[data-search-more]").count(), 0);
        assert.equal(await page.locator("#site-search-content img").count(), 0);

        await open("partial");
        assert.equal(await page.locator(".site-search__result").count(), 6);
        assert.match(await page.locator("#site-search-summary").textContent(), /Some results/);
        const beforeRetry = { ...counts };
        await page.locator("[data-search-retry]").click();
        await page.waitForSelector('[data-search-state="results"]');
        assert.equal(await page.locator(".site-search__result").count(), 7);
        assert.equal(await page.locator("[data-search-retry]").count(), 0);
        assert.equal(counts.searches - beforeRetry.searches, 1);
        assert.equal(counts.details - beforeRetry.details, 8);
        assert.match(
            await page.locator(".site-search__result-title").nth(1).textContent(),
            /partial 1/,
        );
        assert.equal(await page.locator("#site-search-content img").count(), 0);

        failPartial = true;
        await open("partial");
        const beforeMore = { ...counts };
        await page.locator("[data-search-more]").click();
        await page.waitForSelector('[data-search-state="results"]');
        assert.equal(await page.locator(".site-search__result").count(), 15);
        assert.equal(counts.searches, beforeMore.searches);
        assert.equal(counts.details - beforeMore.details, 9);
        assert.equal(await page.locator("[data-search-retry]").count(), 0);
        assert.deepEqual(
            await page.locator(".site-search__result-title").allTextContents(),
            Array.from({ length: 16 }, (_, index) => index)
                .filter((index) => index !== 2)
                .map((index) => `partial ${index}`),
        );

        await open("stale");
        const stalePending = pausePagination();
        await page.locator("[data-search-more]").click();
        const stale = await stalePending;
        assert.equal(await page.locator(".site-search__result").count(), 8);
        assert.equal(await page.locator("[data-search-more]").isDisabled(), true);
        await page.locator("#site-search-input").fill("replacement");
        await page.waitForSelector('[data-search-state="results"]');
        await stale.route.fulfill({ json: stale.data });
        await page.waitForTimeout(50);
        assert.match(
            await page.locator(".site-search__result-title").first().textContent(),
            /replacement/,
        );
        assert.equal(await page.locator(".site-search__result").count(), 8);

        await open("closed");
        const closedPending = pausePagination();
        await page.locator("[data-search-more]").click();
        const closed = await closedPending;
        await page.keyboard.press("Escape");
        await closed.route.fulfill({ json: closed.data });
        await page.waitForTimeout(50);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        await page.locator("#search-trigger").click();
        await page.waitForSelector('[data-search-state="results"]');
        assert.equal(await page.locator("#site-search-input").inputValue(), "closed");
        assert.equal(await page.locator(".site-search__result").count(), 16);

        await open("before-update");
        const beforeUpdate = { ...counts };
        version = "fixture-v2";
        await page.locator("[data-search-more]").click();
        await page.waitForSelector('[data-search-state="outdated"]');
        assert.equal(counts.searches, beforeUpdate.searches);
        assert.equal(counts.details, beforeUpdate.details);
        assert.equal(await page.locator("[data-search-result-link]").count(), 0);

        await open("during-update");
        changeVersion = true;
        await page.locator("[data-search-more]").click();
        await page.waitForSelector('[data-search-state="outdated"]');
        assert.equal(await page.locator("[data-search-result-link]").count(), 0);
        assert.deepEqual(errors, []);
        console.log(
            `Search pagination: ${JSON.stringify(stages)}; Retry, malformed URL, cancellation and index updates passed.`,
        );
        return stages;
    } finally {
        await context.close();
    }
}
