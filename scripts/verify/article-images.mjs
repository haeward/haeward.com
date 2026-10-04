import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const articlePath = "/posts/2025/travelogue-of-southern-shanxi/";
const photo = "https://webp.haeward.com/2025/08/xiaoxitian.jpg";

function imageFixture({ width, height }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#888"/></svg>`;
}

function requestedVariant(manifest, rawUrl) {
    const url = new URL(rawUrl);
    const requestWidth = Number(url.searchParams.get("width"));
    url.searchParams.delete("width");
    return manifest[url.toString()]?.variants.find(
        (variant) => variant.requestWidth === requestWidth,
    );
}

async function verifyPendingImageLayout(browser, baseUrl, manifest) {
    const dimensions = [];
    for (const status of [200, 503]) {
        for (const viewport of [
            { width: 390, height: 844 },
            { width: 1280, height: 844 },
        ]) {
            const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
            let release;
            await context.route("https://webp.haeward.com/**", (route) => route.abort());
            await context.route("**/yuncheng-sunset-glow.jpeg*", async (route) => {
                const variant = requestedVariant(manifest, route.request().url());
                assert(variant, "The first image requested an unlisted responsive size");
                await new Promise((resolve) => {
                    release = resolve;
                });
                await route.fulfill({
                    status,
                    contentType: status === 200 ? "image/svg+xml" : "text/plain",
                    body: status === 200 ? imageFixture(variant) : "Unavailable",
                });
            });
            const page = await context.newPage();
            try {
                await page.goto(`${baseUrl}${articlePath}`, { waitUntil: "domcontentloaded" });
                const image = page.locator(".blog-figure__image").first();
                assert.equal(await image.getAttribute("loading"), "eager");
                assert.equal(await image.getAttribute("fetchpriority"), "high");
                assert.equal(
                    await page.locator('.blog-figure__image:not([loading="lazy"])').count(),
                    1,
                );
                await image.scrollIntoViewIfNeeded();
                await page.waitForTimeout(100);
                const before = await image.boundingBox();
                assert(before.width > 300 && before.height > 200, "Pending image lost its space");
                const caption = image.locator("xpath=../following-sibling::figcaption");
                const beforeCaption = await caption.boundingBox();
                await page.evaluate(() => {
                    let shifts = 0;
                    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
                        new PerformanceObserver((list) => {
                            for (const entry of list.getEntries()) shifts += entry.value;
                        }).observe({ type: "layout-shift" });
                    }
                    Object.defineProperty(window, "__articleImageLayoutShift", {
                        configurable: true,
                        get: () => shifts,
                    });
                });
                assert(release, "The first image was not requested");
                release();
                if (status === 200) await image.evaluate((node) => node.decode());
                else
                    await page.waitForFunction(() => {
                        const image = document.querySelector(".blog-figure__image");
                        return image.complete && image.naturalWidth === 0;
                    });
                await page.waitForTimeout(100);
                const after = await image.boundingBox();
                const afterCaption = await caption.boundingBox();
                for (const key of ["x", "y", "width", "height"]) {
                    assert(Math.abs(before[key] - after[key]) < 0.5, `Image changed its ${key}`);
                    assert(
                        Math.abs(beforeCaption[key] - afterCaption[key]) < 0.5,
                        `Image moved its caption ${key}`,
                    );
                }
                const shifts = await page.evaluate(() => window.__articleImageLayoutShift);
                assert(shifts < 0.001, `Image decoding shifted the page: ${shifts}`);
                dimensions.push({
                    status,
                    viewport: viewport.width,
                    width: before.width,
                    height: before.height,
                });
            } finally {
                release?.();
                await context.close();
            }
        }
    }
    console.log(`Article image loading: reserved stable boxes ${JSON.stringify(dimensions)}.`);
}

export async function verifyArticleImages(browser, baseUrl) {
    const manifest = JSON.parse(await readFile("src/data/article-images.json", "utf8"));
    const entry = manifest[photo];
    assert(entry, "Remote photo dimensions are missing");
    assert(entry.variants.length > 1, "Remote photo has no responsive variants");
    const variantSources = entry.variants.map((variant) => {
        assert(variant.requestWidth > 0 && variant.width > 0 && variant.height > 0);
        const url = new URL(photo);
        url.searchParams.set("width", String(variant.requestWidth));
        return { src: url.toString(), width: variant.width };
    });
    await verifyPendingImageLayout(browser, baseUrl, manifest);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Image checks must not depend on the remote CDN being online.
    await context.route("https://webp.haeward.com/**", (route) => {
        const variant = requestedVariant(manifest, route.request().url());
        return variant
            ? route.fulfill({ contentType: "image/svg+xml", body: imageFixture(variant) })
            : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    try {
        await page.goto(`${baseUrl}${articlePath}`);
        const target = page.locator(`[data-image-zoom][href="${photo}"]`);
        const dialog = page.locator("#image-lightbox");
        const viewer = page.locator(".image-lightbox__img");
        assert.equal(
            await target.locator("img").getAttribute("srcset"),
            variantSources.map(({ src, width }) => `${src} ${width}w`).join(", "),
        );
        for (const viewport of [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
            { width: 1440, height: 900 },
            { width: 320, height: 568 },
        ]) {
            await page.setViewportSize(viewport);
            await target.scrollIntoViewIfNeeded();
            await page.waitForFunction(async (src) => {
                const image = document.querySelector(`[data-image-zoom][href="${src}"] img`);
                try {
                    await image.decode();
                    return image.complete && image.naturalWidth > 0;
                } catch {
                    // WebKit can replace the selected srcset source after resize.
                    return false;
                }
            }, photo);
            const previewSrc = await target.locator("img").evaluate((image) => image.currentSrc);
            assert(variantSources.some((variant) => variant.src === previewSrc));
            await target.focus();
            // Exercise focused-link prefetch before opening the viewer.
            await page.waitForTimeout(150);
            await page.keyboard.press("Enter");
            await page.waitForFunction(() => {
                const dialog = document.querySelector("#image-lightbox");
                return (
                    dialog.classList.contains("is-ready") &&
                    !dialog.classList.contains("is-loading")
                );
            });
            const bounds = await viewer.boundingBox();
            assert(bounds.width > 50 && bounds.height > 50);
            assert(bounds.x >= 0 && bounds.y >= 0);
            assert(bounds.x + bounds.width <= viewport.width + 1);
            assert(bounds.y + bounds.height <= viewport.height + 1);
            assert(
                Math.abs(bounds.width / bounds.height - entry.width / entry.height) < 0.01,
                "Portrait is distorted",
            );
            assert(await page.getByRole("button", { name: "Close", exact: true }).isVisible());
            assert.equal(
                await page.locator(".image-lightbox__original").getAttribute("href"),
                photo,
            );
            const viewerSrc = await viewer.getAttribute("src");
            assert(
                variantSources.some((variant) => variant.src === viewerSrc),
                "Viewer did not select a remote responsive variant",
            );
            await page.keyboard.press("Escape");
            await page.waitForFunction(() =>
                document.activeElement?.hasAttribute("data-image-zoom"),
            );
        }
        assert(!requests.includes(photo), "Viewer downloaded original automatically");
        const mail = await page.locator('.post-replies a[href^="mailto:"]').getAttribute("href");
        assert.equal(new URL(mail).pathname, "me@haeward.com");
        assert.match(new URL(mail).searchParams.get("subject"), /^Re: .+/);
        assert.equal(await page.locator('.post-replies [aria-disabled="true"]').count(), 1);
        assert.equal(await page.locator('.post-replies a[href="#"]').count(), 0);

        // A deterministic slow/failing full-size request must keep the decoded preview.
        // Only the fixture strips srcset to exercise the original fallback path.
        await target.evaluate((link) => {
            const image = link.querySelector("img");
            image.src = image.currentSrc;
            image.removeAttribute("srcset");
            link.href = "/__image-test/large.jpg";
        });
        let release;
        let requested;
        const requestStarted = new Promise((resolve) => {
            requested = resolve;
        });
        await page.route("**/__image-test/large.jpg", async (route) => {
            await new Promise((resolve) => {
                release = resolve;
                requested();
            });
            await route.fulfill({ status: 503, body: "Unavailable" });
        });
        const fixtureTarget = page.locator('[data-image-zoom][href="/__image-test/large.jpg"]');
        await fixtureTarget.click();
        await page.waitForFunction(() =>
            document.querySelector("#image-lightbox").classList.contains("is-loading"),
        );
        assert(await viewer.isVisible());
        assert.equal(await viewer.evaluate((image) => getComputedStyle(image).opacity), "1");
        await requestStarted;
        release();
        await page.waitForSelector("#image-lightbox.is-error");
        assert(await viewer.isVisible(), "Failure removed usable preview");
        assert(await page.getByRole("button", { name: "Retry", exact: true }).isVisible());
        await page.unroute("**/__image-test/large.jpg");
        await page.route("**/__image-test/large.jpg", (route) =>
            route.fulfill({
                status: 200,
                contentType: "image/svg+xml",
                body: imageFixture(entry),
            }),
        );
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.waitForFunction(
            () => !document.querySelector("#image-lightbox").classList.contains("is-loading"),
        );
        assert(
            await dialog.evaluate(
                (node) =>
                    node.open &&
                    node.classList.contains("is-ready") &&
                    !node.classList.contains("is-error"),
            ),
        );
        await page.keyboard.press("Escape");
        assert.deepEqual(errors, []);
    } finally {
        await context.close();
    }
    console.log(
        "Article images: remote responsive viewer, replies, preview fallback and retry passed.",
    );
}
