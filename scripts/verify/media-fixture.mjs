import { readFile } from "node:fs/promises";

const pageSize = 24;
const counts = { movies: 53, books: 3, series: 2, anime: 0 };

export function mediaPage(tab, page) {
    const totalCount = counts[tab];
    const start = (page - 1) * pageSize;
    return {
        tab,
        page,
        pageSize,
        totalCount,
        hasMore: start + pageSize < totalCount,
        items: Array.from(
            { length: Math.max(0, Math.min(pageSize, totalCount - start)) },
            (_, i) => ({
                title: `Fixture ${tab} ${start + i}`,
                url: `https://example.com/${tab}/${start + i}`,
                cover: "/assets/images/site/favicon-32.png",
                myRating: 4,
            }),
        ),
    };
}

export async function installMediaFixture(context) {
    const manifest = {
        defaultTab: "movies",
        pageSize,
        endpointBase: "/media/data",
        tabs: Object.fromEntries(Object.entries(counts).map(([tab, count]) => [tab, { count }])),
    };
    const source = await readFile("dist/media/index.html", "utf8");
    const html = source
        .replace(
            /(<script\b[^>]*id="media-data"[^>]*>)[\s\S]*?(<\/script>)/,
            (_, open, close) => open + JSON.stringify(manifest) + close,
        )
        .replace(/(<ul\b[^>]*data-media-grid[^>]*>)[\s\S]*?(<\/ul>)/g, "$1$2");
    await context.route("**/media/", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
    );
    await context.route("**/media/data/*/*.json", (route) => {
        const [, tab, number] = new URL(route.request().url()).pathname.match(
            /data\/([^/]+)\/(\d+)\.json$/,
        );
        return route.fulfill({ json: mediaPage(tab, Number(number)) });
    });
}
