import type { CollectionEntry } from "astro:content";
import pageOgData from "../data/og-pages.json";

type OgMeta = {
    ogImage?: string;
    ogImageAlt?: string;
};

type PageOgKey = keyof typeof pageOgData;

export function getPageOg(key: PageOgKey): OgMeta {
    const entry = pageOgData[key];

    return {
        ogImage: entry.og,
        ogImageAlt: entry.ogAlt ?? entry.title,
    };
}

export function getPostOg(post: CollectionEntry<"blog">): OgMeta {
    if (!post.data.og) return {};

    return {
        ogImage: post.data.og,
        ogImageAlt: post.data.ogAlt ?? post.data.title,
    };
}
