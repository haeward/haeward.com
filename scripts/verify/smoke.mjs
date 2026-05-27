import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const DIST_DIR = path.resolve("dist");
const HOST = "127.0.0.1";
const ARTICLE_SLUG = "/posts/2025/travelogue-of-southern-shanxi/";
const MOCK_MASTODON_ACCOUNT_ID = "114251868212289038";

function renderMockMastodonContent(index) {
    if (index === 2) {
        return `<p class="quote-inline">RE: <a href="https://mas.to/@quoted/1">Quote inline source</a></p><p>Moment ${index + 1} from Mastodon.</p>`;
    }

    if (index === 3) {
        return `<p>Moment ${index + 1} from Mastodon. <a href="https://mas.to/tags/now">#Now</a></p>`;
    }

    if (index === 4) {
        return `<p>Moment ${index + 1} from Mastodon. :blobcatsweat: Custom emoji check.</p>`;
    }

    return `<p>Moment ${index + 1} from Mastodon. <a href="https://example.com/article">example.com</a></p>`;
}

const MOCK_MASTODON_ACCOUNT = {
    acct: "haeward",
    avatar: "/assets/images/site/favicon.png",
    display_name: "Haeward",
    url: "https://mas.to/@haeward",
    username: "haeward",
};

function renderMockMastodonCreatedAt(index) {
    return new Date(Date.UTC(2026, 3, 21 + index, 16, 57)).toISOString();
}

const MOCK_MASTODON_VISIBLE_STATUSES = Array.from({ length: 40 }, (_, index) => ({
    id: `moment-${index + 1}`,
    account: MOCK_MASTODON_ACCOUNT,
    card:
        index === 0
            ? {
                  description: "A linked article preview.",
                  image: "/assets/images/site/favicon.png",
                  provider_name: "Example",
                  title: "Example preview",
                  url: "https://example.com/article",
              }
            : null,
    content: renderMockMastodonContent(index),
    created_at: renderMockMastodonCreatedAt(index),
    emojis:
        index === 4
            ? [
                  {
                      shortcode: "blobcatsweat",
                      static_url: "/assets/images/site/favicon.png",
                      url: "/assets/images/site/favicon.png",
                  },
              ]
            : [],
    media_attachments:
        index === 1
            ? [
                  {
                      description: "Preview attachment",
                      preview_url: "/assets/images/site/favicon.png",
                      type: "image",
                      url: "/assets/images/site/favicon.png",
                  },
              ]
            : [],
    quote:
        index === 2
            ? {
                  state: "accepted",
                  quoted_status: {
                      account: {
                          acct: "quoted",
                          avatar: "/assets/images/site/favicon.png",
                          avatar_static: "/assets/images/site/favicon.png",
                          display_name: "Quoted User",
                          url: "https://mas.to/@quoted",
                      },
                      card: {
                          description: "A quoted link preview.",
                          image: "/assets/images/site/favicon.png",
                          image_description: "Quoted preview image",
                          provider_name: "Quoted Site",
                          title: "Quoted preview title",
                          url: "https://example.com/quoted",
                      },
                      content: "<p>A quoted toot preview.</p>",
                      created_at: "2026-04-20T08:30:00.000Z",
                      url: "https://mas.to/@quoted/1",
                  },
              }
            : null,
    tags:
        index === 3
            ? [
                  {
                      name: "Now",
                      url: "https://mas.to/tags/now",
                  },
              ]
            : [],
    url: `https://mas.to/@haeward/${index + 1}`,
}));

const MOCK_MASTODON_BOOSTED_STATUS = {
    id: "boosted-moment",
    account: MOCK_MASTODON_ACCOUNT,
    content: "<p>Boost wrapper should stay hidden.</p>",
    created_at: "2026-04-30T16:57:00.000Z",
    media_attachments: [],
    reblog: {
        id: "boosted-original",
        account: {
            acct: "boosted",
            avatar: "/assets/images/site/favicon.png",
            display_name: "Boosted User",
            url: "https://mas.to/@boosted",
            username: "boosted",
        },
        content: "<p>Boosted toot should render.</p>",
        created_at: "2026-04-30T15:57:00.000Z",
        media_attachments: [],
        url: "https://mas.to/@boosted/1",
    },
    url: "https://mas.to/@haeward/boosted",
};

const MOCK_MASTODON_STATUSES = [
    {
        id: "reply-moment",
        account: MOCK_MASTODON_ACCOUNT,
        content: `<p>Reply should render. <a href="https://mas.to/@someone/1">Reply source</a></p>`,
        created_at: "2026-04-29T16:57:00.000Z",
        in_reply_to_account_id: "someone",
        in_reply_to_id: "114251868212289000",
        media_attachments: [],
        url: "https://mas.to/@haeward/reply",
    },
    MOCK_MASTODON_BOOSTED_STATUS,
    ...MOCK_MASTODON_VISIBLE_STATUSES,
];

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".xml": "application/xml; charset=utf-8",
};

function fail(message) {
    throw new Error(message);
}

async function ensureBuiltSite() {
    await access(DIST_DIR);
}

async function resolveRequestPath(urlPath) {
    const pathname = decodeURIComponent(new URL(urlPath, `http://${HOST}`).pathname);
    let filePath = path.join(DIST_DIR, pathname);
    if (pathname.endsWith("/")) {
        filePath = path.join(DIST_DIR, pathname, "index.html");
    }

    try {
        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) {
            return path.join(filePath, "index.html");
        }
        return filePath;
    } catch {
        if (!path.extname(filePath)) {
            return path.join(filePath, "index.html");
        }
        throw new Error(`Missing file for ${pathname}`);
    }
}

async function startStaticServer() {
    const server = http.createServer(async (req, res) => {
        if (!req.url) {
            res.writeHead(400);
            res.end("Bad Request");
            return;
        }

        try {
            const filePath = await resolveRequestPath(req.url);
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {
                "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
            });
            createReadStream(filePath).pipe(res);
        } catch {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("Not Found");
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, HOST, resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
        fail("Unable to determine smoke server address.");
    }

    return {
        server,
        baseUrl: `http://${HOST}:${address.port}`,
    };
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
        if (request.resourceType() === "image" && failureText.includes("ERR_ABORTED")) {
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

async function assertMediaTabAutoLoadMore(page, tabName, label) {
    const panelSelector = `[data-tab-panel="${tabName}"]:not([hidden])`;
    const gridItemSelector = `${panelSelector} [data-media-grid] > li`;
    const sentinelSelector = `${panelSelector} [data-media-sentinel]`;

    const { initialCount, totalCount } = await getMediaTabCounts(page, tabName);
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

    await page.locator(sentinelSelector).scrollIntoViewIfNeeded();
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
}

function countMediaRequests(requestLog, pathname) {
    return requestLog.filter((entry) => entry === pathname).length;
}

async function run() {
    await ensureBuiltSite();
    const { server, baseUrl } = await startStaticServer();
    const browser = await chromium.launch({ headless: true });

    try {
        await assertStatus(baseUrl, "/", 200);
        await assertStatus(baseUrl, "/about/", 200);
        await assertStatus(baseUrl, "/posts/", 200);
        await assertStatus(baseUrl, "/blog/", 404);
        await assertStatus(baseUrl, "/blog/2025/travelogue-of-southern-shanxi/", 404);
        await assertStatus(baseUrl, "/now/", 200);
        await assertStatus(baseUrl, "/moments/", 200);
        await assertStatus(baseUrl, "/toolbox/", 200);
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

        const momentsHtml = await fetch(new URL("/moments/", baseUrl)).then((response) =>
            response.text(),
        );
        if (!momentsHtml.includes('data-moments-more="true" hidden')) {
            fail("Expected /moments to hide the Mastodon more link before moments load.");
        }

        const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
        await page.addInitScript(
            ({ accountId, statuses }) => {
                const originalFetch = window.fetch.bind(window);

                window.fetch = async (input, init) => {
                    const url =
                        typeof input === "string"
                            ? input
                            : input instanceof Request
                              ? input.url
                              : String(input);

                    if (url.startsWith(`https://mas.to/api/v1/accounts/${accountId}/statuses`)) {
                        return {
                            ok: true,
                            async json() {
                                return statuses;
                            },
                        };
                    }

                    return originalFetch(input, init);
                };
            },
            {
                accountId: MOCK_MASTODON_ACCOUNT_ID,
                statuses: MOCK_MASTODON_STATUSES,
            },
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
        const homeImageSrc = await page.locator('img[alt="programmer"]').getAttribute("src");
        if (homeImageSrc !== "/assets/images/site/home-hover-runtime.webp") {
            fail(
                `Expected homepage runtime image to use optimized asset, received ${homeImageSrc}.`,
            );
        }
        const navLabels = await page
            .locator("header nav a")
            .evaluateAll((links) => links.map((link) => link.textContent?.trim() || ""));
        const expectedNavLabels = ["Archive", "Media", "Now", "About", "Links"];
        if (expectedNavLabels.some((label, index) => navLabels[index] !== label)) {
            fail(
                `Expected header nav to start with ${expectedNavLabels.join(", ")}. Received ${navLabels.join(", ")}.`,
            );
        }

        await assertOk(page, `${baseUrl}/now/`, "Now");
        const nowMomentsCount = await page.locator("[data-moments-item='true']").count();
        if (nowMomentsCount !== 0) {
            fail(`Expected /now to omit moments, received ${nowMomentsCount}.`);
        }

        await assertOk(page, `${baseUrl}/moments/`, "Moments");
        await page.waitForSelector("[data-moments-item='true']");
        const momentsCount = await page.locator("[data-moments-item='true']").count();
        if (momentsCount !== 40) {
            fail(`Expected /moments to render 40 moments, received ${momentsCount}.`);
        }
        if ((await page.locator("text=Reply should render").count()) !== 1) {
            fail("Expected /moments to render reply statuses.");
        }
        if ((await page.locator("text=Boost wrapper should stay hidden").count()) !== 0) {
            fail("Expected /moments to hide boosted status wrappers.");
        }
        if ((await page.locator("text=Boosted toot should render").count()) !== 1) {
            fail("Expected /moments to render boosted toot content.");
        }
        await page.waitForSelector('[data-moments-boost="true"]:has-text("Haeward boosted")');
        await page.waitForSelector('[data-moments-boost-avatar="true"]');
        await page.waitForSelector(
            '[data-moments-reply="true"]:has-text("Haeward replied to") a[href="https://mas.to/web/statuses/114251868212289000"]:has-text("toot")',
        );
        await page.waitForSelector('a[href="https://mas.to/@haeward/reply"]:has-text("View Toot")');
        if ((await page.locator("text=Quote inline source").count()) !== 0) {
            fail("Expected /moments to hide Mastodon inline quote source links.");
        }
        await page.waitForSelector('[data-moments-author="true"]');
        await page.waitForSelector('[data-moments-author-avatar="true"]');
        await page.waitForSelector(
            '[data-moments-author-handle="true"]:has-text("@haeward@mas.to")',
        );
        await page.waitForSelector('a:has-text("View Toot")');
        await page.waitForSelector('a:has-text("Example preview")');
        await page.waitForSelector("text=A quoted toot preview.");
        await page.waitForSelector('[data-moments-quote="true"]');
        await page.waitForSelector('[data-moments-quote-avatar="true"]');
        await page.waitForSelector(
            '[data-moments-quote-card-image="true"][alt="Quoted preview image"]',
        );
        await page.waitForSelector('a:has-text("Quoted preview title")');
        await page.waitForSelector('a:has-text("#Now")');
        await page.waitForSelector('[data-moments-tag="true"]:has-text("#Now")');
        await page.waitForSelector('[data-moments-emoji="true"][alt=":blobcatsweat:"]');
        await page.waitForSelector('[data-moments-media="true"][alt="Preview attachment"]');
        await page.waitForSelector(
            '[data-moments-mastodon-more="true"][href="https://mas.to/@haeward"]:has-text("View more on Mastodon")',
        );

        await assertOk(page, `${baseUrl}/links/`, "Links");
        await page.waitForSelector('[data-links-section="blogroll"] [data-link-card="true"]');
        await page.waitForSelector('[data-links-section="videos"] [data-link-card="true"]');
        await page.waitForSelector('[data-links-section="podcasts"]');

        const blogrollCount = await page
            .locator('[data-links-section="blogroll"] [data-link-card="true"]')
            .count();
        const videoCount = await page
            .locator('[data-links-section="videos"] [data-link-card="true"]')
            .count();
        if (blogrollCount === 0 || videoCount === 0) {
            fail(
                `Expected Links page to render both blogroll and video entries, received ${blogrollCount} and ${videoCount}.`,
            );
        }

        const themeToggle = page.locator("#theme-toggle");
        await page.waitForFunction(() => document.documentElement.dataset.themeMode === "system");
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
        await assertMediaTabAutoLoadMore(page, "movies", "Desktop media tab");
        if (countMediaRequests(desktopMediaRequests, "/media/data/movies/2.json") !== 1) {
            fail(`Expected /media/data/movies/2.json to be requested once for desktop load more.`);
        }

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
        await page.waitForSelector(".image-lightbox:not(.is-open)");
        await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
        await page.waitForSelector(
            '[data-toc-root="true"][data-toc-visible="true"] [data-toc-link="true"]',
        );
        await page
            .locator('[data-toc-root="true"][data-toc-visible="true"] [data-toc-link="true"]')
            .first()
            .click();
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
        await assertMediaTabAutoLoadMore(mobilePage, "movies", "Mobile media tab");
        if (countMediaRequests(mobileMediaRequests, "/media/data/movies/2.json") !== 1) {
            fail(`Expected /media/data/movies/2.json to be requested once for mobile load more.`);
        }

        assertNoErrors();
        assertNoMobileErrors();
        await mobilePage.close();
        await page.close();
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
