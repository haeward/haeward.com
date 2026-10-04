import { getImage } from "astro:assets";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ImageMetadata } from "astro";
import bookData from "../data/douban/book.json";
import movieData from "../data/douban/movie.json";

type DoubanRating = {
    max?: number;
    value?: number;
};

type DoubanSubject = {
    title?: string;
    url?: string;
    sharing_url?: string;
    pic?: {
        normal?: string;
    };
    cover_url?: string;
    type?: string;
    subtype?: string;
    genres?: string[];
};

type DoubanItem = {
    rating?: DoubanRating;
    create_time?: string;
    status?: string;
    is_private?: boolean;
    sharing_url?: string;
    subject?: DoubanSubject;
};

type NormalizedItem = {
    title: string;
    url?: string;
    cover?: string;
    myRating?: number;
    subjectType?: string;
    genres?: string[];
};

export type ClientMediaItem = Pick<NormalizedItem, "title" | "url" | "cover" | "myRating">;
export type MediaTabKey = "movies" | "series" | "anime" | "books";
export type MediaTab = {
    key: MediaTabKey;
    label: string;
    count: number;
};
export type MediaDataPage = {
    tab: MediaTabKey;
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
    items: ClientMediaItem[];
};
export type MediaManifest = {
    defaultTab: MediaTabKey;
    pageSize: number;
    endpointBase: string;
    tabs: Record<MediaTabKey, { count: number }>;
};
type MediaKind = "movie" | "book";

const MEDIA_PAGE_SIZE = 100;
const DEFAULT_MEDIA_TAB: MediaTabKey = "movies";
const MEDIA_DATA_ENDPOINT_BASE = "/media/data";
const localCovers = import.meta.glob<ImageMetadata>(
    "../../public/douban/{movie,book}/*.{jpg,jpeg,png,webp,avif}",
    { eager: true, import: "default" },
);

let mediaItemsByTabCache: Promise<Record<MediaTabKey, ClientMediaItem[]>> | null = null;

export async function getMediaPageData() {
    const itemsByTab = await getMediaItemsByTab();
    const tabs = getMediaTabs(itemsByTab);

    return {
        tabs,
        defaultItems: itemsByTab[DEFAULT_MEDIA_TAB].slice(0, MEDIA_PAGE_SIZE),
        manifest: createMediaManifest(itemsByTab),
    };
}

function getMediaItemsByTab(): Promise<Record<MediaTabKey, ClientMediaItem[]>> {
    mediaItemsByTabCache ??= loadMediaItemsByTab();
    return mediaItemsByTabCache;
}

async function loadMediaItemsByTab(): Promise<Record<MediaTabKey, ClientMediaItem[]>> {
    const [movieCoverIndex, bookCoverIndex] = await Promise.all([
        createLocalCoverIndex("movie"),
        createLocalCoverIndex("book"),
    ]);
    const movieEntries = normalizeItems(movieData as DoubanItem[], movieCoverIndex);
    const books = normalizeItems(bookData as DoubanItem[], bookCoverIndex);

    const isAnimation = (item: NormalizedItem) => item.genres?.includes("动画") ?? false;
    const movieItems = movieEntries.filter(
        (item) => !isAnimation(item) && item.subjectType !== "tv",
    );
    const seriesItems = movieEntries.filter(
        (item) => !isAnimation(item) && item.subjectType === "tv",
    );
    const animeItems = movieEntries.filter((item) => isAnimation(item));

    return {
        movies: movieItems.map(toClientMediaItem),
        series: seriesItems.map(toClientMediaItem),
        anime: animeItems.map(toClientMediaItem),
        books: books.map(toClientMediaItem),
    };
}

function getMediaTabs(itemsByTab: Record<MediaTabKey, ClientMediaItem[]>): MediaTab[] {
    return [
        { key: "movies", label: "Movies", count: itemsByTab.movies.length },
        { key: "series", label: "Series", count: itemsByTab.series.length },
        { key: "anime", label: "Anime", count: itemsByTab.anime.length },
        { key: "books", label: "Books", count: itemsByTab.books.length },
    ];
}

function createMediaManifest(itemsByTab: Record<MediaTabKey, ClientMediaItem[]>): MediaManifest {
    return {
        defaultTab: DEFAULT_MEDIA_TAB,
        pageSize: MEDIA_PAGE_SIZE,
        endpointBase: MEDIA_DATA_ENDPOINT_BASE,
        tabs: {
            movies: { count: itemsByTab.movies.length },
            series: { count: itemsByTab.series.length },
            anime: { count: itemsByTab.anime.length },
            books: { count: itemsByTab.books.length },
        },
    };
}

function getMediaPagePayload(
    tab: MediaTabKey,
    page: number,
    itemsByTab: Record<MediaTabKey, ClientMediaItem[]>,
): MediaDataPage {
    const items = itemsByTab[tab];
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * MEDIA_PAGE_SIZE;
    const end = start + MEDIA_PAGE_SIZE;

    return {
        tab,
        page: safePage,
        pageSize: MEDIA_PAGE_SIZE,
        totalCount: items.length,
        hasMore: end < items.length,
        items: items.slice(start, end),
    };
}

export async function getMediaDataStaticPaths() {
    const itemsByTab = await getMediaItemsByTab();

    return (Object.entries(itemsByTab) as [MediaTabKey, ClientMediaItem[]][]).flatMap(
        ([tab, items]) =>
            Array.from({ length: Math.ceil(items.length / MEDIA_PAGE_SIZE) }, (_, index) => {
                const page = index + 1;

                return {
                    params: { tab, page: String(page) },
                    props: { payload: getMediaPagePayload(tab, page, itemsByTab) },
                };
            }),
    );
}

function parseDate(value?: string): Date | undefined {
    if (!value) return;

    const parsed = new Date(value.replace(" ", "T"));
    if (Number.isNaN(parsed.valueOf())) return;

    return parsed;
}

function formatRating(rating?: DoubanRating): number | undefined {
    if (!rating || typeof rating.value !== "number") return;

    const max = typeof rating.max === "number" ? rating.max : 5;
    if (max <= 0) return;

    return Math.max(0, Math.min(rating.value, max));
}

function normalizeItems(
    items: DoubanItem[],
    localCoverIndex: Map<string, string>,
): NormalizedItem[] {
    return items
        .filter((item) => item.status === "done" && !item.is_private)
        .sort((a, b) => {
            const aTime = parseDate(a.create_time)?.valueOf() ?? 0;
            const bTime = parseDate(b.create_time)?.valueOf() ?? 0;
            return bTime - aTime;
        })
        .map((item) => {
            const subject = item.subject ?? {};
            const title = subject.title ?? "Untitled";
            const url = subject.url ?? subject.sharing_url ?? item.sharing_url;
            const subjectId = getSubjectId(subject.url ?? subject.sharing_url ?? item.sharing_url);
            const remoteCover = subject.pic?.normal ?? subject.cover_url;

            return {
                title,
                url,
                cover: resolveCover(localCoverIndex, subjectId, remoteCover),
                myRating: formatRating(item.rating),
                subjectType: subject.subtype ?? subject.type,
                genres: subject.genres ?? [],
            };
        });
}

function toClientMediaItem(item: NormalizedItem): ClientMediaItem {
    return {
        title: item.title,
        url: item.url,
        cover: item.cover,
        myRating: item.myRating,
    };
}

function getSubjectId(value?: string): string | undefined {
    return value?.match(/subject\/(\d+)/)?.[1];
}

async function createLocalCoverIndex(kind: MediaKind): Promise<Map<string, string>> {
    const dir = path.resolve("public", "douban", kind);
    if (!existsSync(dir)) return new Map();

    const files = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile());
    const covers = await Promise.all(
        files.map(async ({ name }): Promise<[string, string]> => {
            const source = localCovers[`../../public/douban/${kind}/${name}`];
            const image = source
                ? await getImage({
                      src: source,
                      width: 540,
                      format: "webp",
                      quality: 75,
                      fit: "contain",
                  })
                : null;
            return [path.parse(name).name, image?.src ?? `/douban/${kind}/${name}`];
        }),
    );
    return new Map(covers);
}

function resolveCover(
    localCoverIndex: Map<string, string>,
    subjectId?: string,
    remoteCover?: string,
): string | undefined {
    if (!subjectId) return remoteCover;

    return localCoverIndex.get(subjectId) ?? remoteCover;
}
