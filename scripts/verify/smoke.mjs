import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { parseBlogroll } from "../../src/lib/blogroll.ts";
import { orderBlogroll } from "../../src/lib/blogroll-order.ts";
import { verifyArticleImages } from "./article-images.mjs";
import { verifyEnhancements } from "./enhancements.mjs";
import { verifyMedia } from "./media.mjs";
import { verifyReading } from "./reading.mjs";
import { verifyResourceLinks } from "./resource-links.mjs";
import { verifyRss } from "./rss.mjs";
import { verifySearchPagination } from "./search-pagination.mjs";
import { startPreview } from "./server.mjs";

const DIST_DIR = path.resolve("dist");
const ARTICLE_SLUG = "/posts/2025/travelogue-of-southern-shanxi/";
function fail(message) {
    throw new Error(message);
}

async function ensureBuiltSite() {
    await access(DIST_DIR);
}

function bindPageDiagnostics(page, label) {
    const errors = [];

    page.on("pageerror", (error) => {
        errors.push(`[${label}] pageerror: ${error.message}`);
    });

    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(`[${label}] console.${message.type()}: ${message.text()}`);
        }
    });

    page.on("requestfailed", (request) => {
        const failureText = request.failure()?.errorText ?? "";
        if (request.resourceType() === "image" && /ERR_ABORTED|cancelled/i.test(failureText)) {
            return;
        }

        errors.push(
            `[${label}] requestfailed: ${request.method()} ${request.url()} (${failureText || "unknown"})`,
        );
    });

    return () => {
        if (errors.length > 0) {
            fail(errors.join("\n"));
        }
    };
}

async function assertOk(page, url, label) {
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) {
        fail(`${label} failed to load: ${response?.status() ?? "no response"}`);
    }
}

async function assertStatus(baseUrl, route, expectedStatus) {
    const response = await fetch(new URL(route, baseUrl));
    if (response.status !== expectedStatus) {
        fail(`Expected ${route} to return ${expectedStatus}, got ${response.status}.`);
    }
}

async function getMediaManifest(page) {
    return page.locator("#media-data").evaluate((node) => JSON.parse(node.textContent || "{}"));
}

async function getMediaTabCounts(page, tabName) {
    return page.locator("#media-data").evaluate((node, name) => {
        const manifest = JSON.parse(node.textContent || "{}");
        const pageSize = Number.parseInt(String(manifest.pageSize || "100"), 10);
        const totalCount = Number(manifest.tabs?.[name]?.count ?? 0);

        return {
            initialCount: Math.min(pageSize, totalCount),
            pageSize,
            totalCount,
        };
    }, tabName);
}

async function waitForActiveMediaTab(page, tabName) {
    await page.waitForFunction((name) => {
        const tab = document.querySelector(`[data-tab="${name}"]`);
        return tab?.getAttribute("aria-selected") === "true";
    }, tabName);
}

async function assertMediaTabInitialLoad(page, tabName, label) {
    const panelSelector = `[data-tab-panel="${tabName}"]:not([hidden])`;
    const gridItemSelector = `${panelSelector} [data-media-grid] > li`;
    const { initialCount } = await getMediaTabCounts(page, tabName);

    if (initialCount === 0) {
        const count = await page.locator(gridItemSelector).count();
        if (count !== 0) {
            fail(`${label} expected no cards for ${tabName}, received ${count}.`);
        }
        return;
    }

    await page.waitForFunction(
        ({ panelSelector, expectedCount }) => {
            const panel = document.querySelector(panelSelector);
            if (!(panel instanceof HTMLElement)) return false;

            return panel.querySelectorAll("[data-media-grid] > li").length === expectedCount;
        },
        { panelSelector, expectedCount: initialCount },
    );
}

async function assertMediaTabAutoLoadMore(page, tabName, label, requestLog) {
    const panelSelector = `[data-tab-panel="${tabName}"]:not([hidden])`;
    const gridItemSelector = `${panelSelector} [data-media-grid] > li`;
    const sentinelSelector = `${panelSelector} [data-media-sentinel]`;

    const { initialCount, pageSize, totalCount } = await getMediaTabCounts(page, tabName);
    await assertMediaTabInitialLoad(page, tabName, label);
    const initialVisibleCount = await page.locator(gridItemSelector).count();
    if (initialVisibleCount !== initialCount) {
        fail(
            `${label} expected ${initialCount} ${tabName} cards initially, received ${initialVisibleCount}.`,
        );
    }

    if (totalCount <= initialCount) {
        return;
    }

    const loadMoreButton = page.locator(`${panelSelector} [data-media-more]`);
    if ((await loadMoreButton.count()) !== 0) {
        fail(`${label} expected auto loading without a visible load-more button.`);
    }

    // Each appended page moves the sentinel down; scroll again to trigger the next page.
    const pageCount = Math.ceil(totalCount / pageSize);
    for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
        const expectedCount = Math.min(pageNumber * pageSize, totalCount);
        if ((await page.locator(gridItemSelector).count()) < expectedCount) {
            await page.locator(sentinelSelector).scrollIntoViewIfNeeded();
        }
        await page
            .waitForFunction(
                ({ gridItemSelector, expectedCount }) =>
                    document.querySelectorAll(gridItemSelector).length >= expectedCount,
                { gridItemSelector, expectedCount },
            )
            .catch(() => fail(`${label} timed out loading ${tabName} page ${pageNumber}.`));
    }

    await page.waitForFunction(
        ({ panelSelector, expectedCount }) => {
            const panel = document.querySelector(panelSelector);
            if (!(panel instanceof HTMLElement)) return false;

            const cards = panel.querySelectorAll("[data-media-grid] > li");
            const sentinel = panel.querySelector("[data-media-sentinel]");
            const sentinelHidden = !(sentinel instanceof HTMLElement) || sentinel.hidden === true;

            return cards.length === expectedCount && sentinelHidden;
        },
        {
            panelSelector,
            expectedCount: totalCount,
        },
    );

    for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
        const pathname = `/media/data/${tabName}/${pageNumber}.json`;
        const requestCount = countMediaRequests(requestLog, pathname);
        if (requestCount !== 1) {
            fail(`${label} expected ${pathname} to be requested once, received ${requestCount}.`);
        }
    }
}

function countMediaRequests(requestLog, pathname) {
    return requestLog.filter((entry) => entry === pathname).length;
}

async function run() {
    await ensureBuiltSite();
    const { server, baseUrl } = await startPreview(DIST_DIR);
    const engine = process.env.SMOKE_BROWSER === "webkit" ? webkit : chromium;
    const browser = await engine.launch({ headless: true });

    try {
        await assertStatus(baseUrl, "/", 200);
        await assertStatus(baseUrl, "/about/", 200);
        await assertStatus(baseUrl, "/posts/", 200);
        await assertStatus(baseUrl, "/blog/", 404);
        await assertStatus(baseUrl, "/blog/2025/travelogue-of-southern-shanxi/", 404);
        await assertStatus(baseUrl, "/now/", 404);
        await assertStatus(baseUrl, "/moments/", 404);
        await assertStatus(baseUrl, "/toolbox/", 404);
        await assertStatus(baseUrl, ARTICLE_SLUG, 200);
        await assertStatus(baseUrl, "/links/", 200);
        await assertStatus(baseUrl, "/media/", 200);
        await assertStatus(baseUrl, "/media/data/movies/1.json", 200);
        await assertStatus(baseUrl, "/media/data/movies/2.json", 200);
        await assertStatus(baseUrl, "/media/data/books/1.json", 200);
        await assertStatus(baseUrl, "/media/data/series/1.json", 200);
        await assertStatus(baseUrl, "/media/data/anime/1.json", 200);
        await assertStatus(baseUrl, "/media/data/books/2.json", 404);
        await assertStatus(baseUrl, "/media/data/unknown/1.json", 404);
        await assertStatus(baseUrl, "/rss.xml", 200);
        await assertStatus(baseUrl, "/robots.txt", 200);
        await assertStatus(baseUrl, "/sitemap-index.xml", 200);
        await assertStatus(baseUrl, "/does-not-exist/", 404);

        const page = await browser.newPage({
            viewport: { width: 1440, height: 960 },
            colorScheme: "light",
        });
        // Keep favicon rendering deterministic; browser smoke never probes external blogs.
        await page.route("https://www.google.com/s2/favicons?*", (route) =>
            route.fulfill({
                path: "public/assets/images/site/favicon-32.png",
                contentType: "image/png",
            }),
        );
        const assertNoErrors = bindPageDiagnostics(page, "desktop");
        const desktopMediaRequests = [];
        page.on("request", (request) => {
            try {
                const url = new URL(request.url());
                if (url.pathname.startsWith("/media/data/")) {
                    desktopMediaRequests.push(url.pathname);
                }
            } catch {}
        });

        await assertOk(page, `${baseUrl}/`, "Home");
        const homeImage = await page.locator('img[alt="programmer"]').evaluate(async (image) => {
            await image.decode();
            const bounds = image.getBoundingClientRect();
            const resource = performance.getEntriesByName(image.currentSrc)[0];
            return {
                src: new URL(image.currentSrc).pathname,
                responsive: image.srcset.split(",").length > 1 && Boolean(image.sizes),
                bytes: resource?.encodedBodySize,
                width: bounds.width,
                height: bounds.height,
            };
        });
        if (
            !homeImage.src.startsWith("/_astro/") ||
            !homeImage.responsive ||
            !(homeImage.bytes > 0 && homeImage.bytes < 6000) ||
            homeImage.width !== 144 ||
            homeImage.height !== 144
        ) {
            fail(
                `Homepage illustration lost responsive sizing or its byte budget: ${JSON.stringify(homeImage)}.`,
            );
        }
        const navLabels = await page
            .locator("header nav a")
            .evaluateAll((links) => links.map((link) => link.textContent?.trim() || ""));
        const expectedNavLabels = ["Archive", "Media", "About", "Blogroll"];
        if (expectedNavLabels.some((label, index) => navLabels[index] !== label)) {
            fail(
                `Expected header nav to start with ${expectedNavLabels.join(", ")}. Received ${navLabels.join(", ")}.`,
            );
        }

        await assertOk(page, `${baseUrl}/links/`, "Blogroll");
        const opml = await readFile("public/subscriptions.opml", "utf8");
        const period = await page.locator("[data-blogroll]").getAttribute("data-blogroll-period");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(period || "")) {
            fail("Blogroll needs the build's ordering period.");
        }
        const expectedBlogs = orderBlogroll(parseBlogroll(opml), period);
        const actualBlogs = await page.locator("[data-blogroll] li a").evaluateAll((anchors) =>
            anchors.map((a) => ({
                name: a.closest("li").querySelector(".blogroll-name").textContent,
                url: a.href,
            })),
        );
        if (JSON.stringify(actualBlogs) !== JSON.stringify(expectedBlogs)) {
            fail(
                "Blogroll must match the OPML names and URLs in the build period's shuffled order.",
            );
        }
        if (await page.locator("[data-links-section], [data-link-status]").count()) {
            fail("Blogroll must not render legacy categories or connectivity indicators.");
        }
        if ((await page.locator("[data-blogroll] img").count()) !== expectedBlogs.length) {
            fail("Every Blogroll card needs an icon with a text fallback.");
        }
        const firstBlogLink = page.locator("[data-blogroll] a").first();
        if (
            (await firstBlogLink.getAttribute("target")) !== "_blank" ||
            (await firstBlogLink.getAttribute("rel")) !== "noopener noreferrer"
        ) {
            fail("Blogroll cards must open in a new tab with safe opener handling.");
        }
        if (!(await page.locator(".page-intro a[download]").count())) {
            fail("The OPML download belongs in the introduction.");
        }
        const download = page.locator('a[download="subscriptions.opml"]');
        const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);
        if (
            saved.suggestedFilename() !== "subscriptions.opml" ||
            (await readFile(await saved.path(), "utf8")) !== opml
        ) {
            fail("OPML download must preserve the maintained file exactly.");
        }
        const noJs = await browser.newContext({ javaScriptEnabled: false });
        try {
            await noJs.route("https://www.google.com/s2/favicons?*", (route) =>
                route.fulfill({
                    path: "public/assets/images/site/favicon-32.png",
                    contentType: "image/png",
                }),
            );
            const plain = await noJs.newPage();
            await plain.goto(`${baseUrl}/links/`);
            if ((await plain.locator("[data-blogroll] li").count()) !== expectedBlogs.length) {
                fail("Blogroll must render without JavaScript.");
            }
            for (const width of [320, 390, 768]) {
                await plain.setViewportSize({ width, height: 844 });
                if (await plain.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
                    fail(`Blogroll overflows at ${width}px.`);
                }
            }
        } finally {
            await noJs.close();
        }

        const themeToggle = page.locator("#theme-toggle");
        await page.waitForFunction(() => document.documentElement.dataset.themeMode === "light");
        await themeToggle.click();
        await page.waitForFunction(() => document.documentElement.dataset.themeMode === "dark");
        await themeToggle.click();
        await page.waitForFunction(() => document.documentElement.dataset.themeMode === "light");
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForFunction(() => document.documentElement.dataset.themeMode === "light");

        await page.goto(`${baseUrl}/media/#books`, { waitUntil: "networkidle" });
        const mediaManifest = await getMediaManifest(page);
        if (
            mediaManifest.defaultTab !== "movies" ||
            mediaManifest.pageSize !== 100 ||
            mediaManifest.endpointBase !== "/media/data"
        ) {
            fail(`Unexpected media manifest: ${JSON.stringify(mediaManifest)}.`);
        }
        await waitForActiveMediaTab(page, "books");
        await assertMediaTabInitialLoad(page, "books", "Desktop books tab");
        if (countMediaRequests(desktopMediaRequests, "/media/data/books/1.json") !== 1) {
            fail(`Expected /media/data/books/1.json to be requested once on first books load.`);
        }

        await page.click('[data-tab="movies"]');
        await page.waitForFunction(() => window.location.hash === "#movies");
        await assertMediaTabInitialLoad(page, "movies", "Desktop movies tab");

        await page.click('[data-tab="books"]');
        await waitForActiveMediaTab(page, "books");
        await assertMediaTabInitialLoad(page, "books", "Desktop books revisit");
        if (countMediaRequests(desktopMediaRequests, "/media/data/books/1.json") !== 1) {
            fail(`Expected books tab revisit to reuse cached data without a second request.`);
        }

        await page.click('[data-tab="series"]');
        await waitForActiveMediaTab(page, "series");
        await assertMediaTabInitialLoad(page, "series", "Desktop series tab");

        await page.click('[data-tab="anime"]');
        await waitForActiveMediaTab(page, "anime");
        await assertMediaTabInitialLoad(page, "anime", "Desktop anime tab");

        await page.click('[data-tab="movies"]');
        await waitForActiveMediaTab(page, "movies");
        await assertMediaTabAutoLoadMore(page, "movies", "Desktop media tab", desktopMediaRequests);

        await page.goto(`${baseUrl}${ARTICLE_SLUG}`, { waitUntil: "networkidle" });
        const articleImageStyles = await page
            .locator(".blog-figure__image")
            .first()
            .evaluate((image) => {
                const styles = window.getComputedStyle(image);
                return {
                    cursor: styles.cursor,
                    maxHeight: styles.maxHeight,
                    objectFit: styles.objectFit,
                };
            });
        if (
            articleImageStyles.cursor !== "zoom-in" ||
            articleImageStyles.objectFit !== "contain" ||
            articleImageStyles.maxHeight === "none"
        ) {
            fail(`Unexpected article image styles: ${JSON.stringify(articleImageStyles)}.`);
        }
        await page.click(".blog-article img");
        await page.waitForSelector(".image-lightbox.is-open");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("#image-lightbox").open);
        await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
        await page.waitForSelector('.blog-toc--desktop [data-toc-link="true"]');
        await page.locator('.blog-toc--desktop [data-toc-link="true"]').first().click();
        await page.waitForTimeout(200);

        const mobilePage = await browser.newPage({
            viewport: { width: 390, height: 844 },
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        });
        const assertNoMobileErrors = bindPageDiagnostics(mobilePage, "mobile");
        const mobileMediaRequests = [];
        mobilePage.on("request", (request) => {
            try {
                const url = new URL(request.url());
                if (url.pathname.startsWith("/media/data/")) {
                    mobileMediaRequests.push(url.pathname);
                }
            } catch {}
        });

        await mobilePage.goto(`${baseUrl}/media/#movies`, { waitUntil: "networkidle" });
        await mobilePage.locator('[data-tab="movies"]').click();
        await mobilePage.waitForFunction(() => window.location.hash === "#movies");
        await assertMediaTabAutoLoadMore(
            mobilePage,
            "movies",
            "Mobile media tab",
            mobileMediaRequests,
        );

        assertNoErrors();
        assertNoMobileErrors();
        await mobilePage.close();
        await page.close();
        await verifyArticleImages(browser, baseUrl);
        await verifyReading(browser, baseUrl);
        await verifyEnhancements(browser, baseUrl);
        await verifyMedia(browser, baseUrl);
        await verifySearchPagination(browser, baseUrl);
        await verifyResourceLinks(browser, baseUrl);
        await verifyRss(browser, baseUrl);
    } finally {
        await browser.close();
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
    }
}

run().then(
    () => {
        console.log("Smoke checks passed.");
    },
    (error) => {
        console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
        process.exitCode = 1;
    },
);
