import assert from "node:assert/strict";

export async function verifyRss(browser, baseUrl) {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.goto(`${baseUrl}/rss.xml`);
        const button = page.locator("#feed-copy");
        await button.waitFor();
        await page.evaluate(() => {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: async () => {
                        throw new Error("Clipboard denied");
                    },
                },
            });
            Object.defineProperty(document, "execCommand", {
                configurable: true,
                value: () => false,
            });
        });
        await button.click();
        await page.waitForFunction(() =>
            document.querySelector("#feed-copy-help").textContent.startsWith("Could not copy"),
        );
        assert.equal(await button.evaluate((node) => node.classList.contains("is-copied")), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), "feed-copy");
        await page.evaluate(() => {
            Object.defineProperty(document, "execCommand", {
                configurable: true,
                value: () => true,
            });
        });
        await button.click();
        await page.waitForFunction(
            () => document.querySelector("#feed-copy-help").textContent === "Feed address copied.",
        );
        await page.evaluate(() => {
            Object.defineProperty(navigator, "clipboard", {
                value: {
                    writeText: async (text) => {
                        window.__feedCopied = text;
                    },
                },
            });
        });
        await button.click();
        assert.equal(await page.evaluate(() => window.__feedCopied), `${baseUrl}/rss.xml`);
    } finally {
        await context.close();
    }
}
