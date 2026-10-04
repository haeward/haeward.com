import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";

export type Blog = { name: string; url: string };

type Outline = {
    text?: string;
    title?: string;
    type?: string;
    htmlUrl?: string;
    xmlUrl?: string;
    outline?: Outline[];
};

const mediaCategory = /^(podcasts?|videos?|youtube|bilibili|播客|视频)$/i;
const mediaHost = /(^|\.)(youtube\.com|youtu\.be|bilibili\.com|spotify\.com|xiaoyuzhoufm\.com)$/i;
const feedSuffix = /\/(?:feed|feeds|rss|rss2|atom|index)(?:\.(?:xml|rss|atom|json))?\/?$/i;
const postsSuffix = /\/posts?\/?$/i;
const trackingParameter = /^(?:utm_[^=]+|fbclid|gclid|mc_cid|mc_eid)$/i;

/** Normalize an OPML website/feed address without making a network request. */
export function normalizeBlogUrl(value: string, fromFeed = false): string {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new Error(`Blogroll: invalid URL ${value}.`);
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error(`Blogroll: URL must use HTTP(S) without credentials: ${value}.`);
    }
    for (const key of [...url.searchParams.keys()]) {
        if (trackingParameter.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    if (fromFeed) {
        const originalPath = url.pathname;
        url.pathname = url.pathname.replace(feedSuffix, "/");
        // A feed at /zh/posts/ belongs to the /zh/ site, not the posts listing.
        url.pathname = url.pathname.replace(postsSuffix, "/");
        if (url.pathname === originalPath) url.pathname = "/";
    } else {
        url.pathname = url.pathname.replace(postsSuffix, "/");
    }
    if (!url.pathname.startsWith("/")) url.pathname = `/${url.pathname}`;
    return url.href;
}

function websiteUrl(outline: Outline, name: string): string {
    const website = outline.htmlUrl?.trim();
    const value = website || outline.xmlUrl?.trim();
    if (!value) {
        throw new Error(`Blogroll: ${name} needs a valid htmlUrl or xmlUrl.`);
    }
    return normalizeBlogUrl(value, !website);
}

/** Parse the maintained OPML at build time; no remote feed or website requests. */
export function parseBlogroll(source: string): Blog[] {
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
        throw new Error("Blogroll: OPML must not contain a DTD or entity declarations.");
    }
    const parser = new XMLParser({
        ignoreAttributes: false,
        htmlEntities: true,
        attributeNamePrefix: "",
        parseAttributeValue: false,
        isArray: (name) => name === "outline",
    });
    let document: { opml?: { body?: { outline?: Outline[] } } };
    try {
        SyntaxValidator.validate(source, { multipleRoots: false });
        document = parser.parse(source);
    } catch (error) {
        throw new Error(
            `Blogroll: invalid OPML: ${error instanceof Error ? error.message : error}`,
        );
    }
    if (!document.opml || document.opml.body === undefined) {
        throw new Error("Blogroll: expected an opml document with a body.");
    }
    const blogs: Blog[] = [];
    const seen = new Set<string>();
    function collect(outlines: Outline[]): void {
        for (const outline of outlines) {
            const name = outline.text?.trim() || outline.title?.trim() || "";
            if (mediaCategory.test(outline.type || "")) continue;
            if (outline.outline) {
                if (!mediaCategory.test(name)) collect(outline.outline);
                continue;
            }
            if (!outline.xmlUrl && !outline.htmlUrl) continue;
            if (!name) throw new Error("Blogroll: each subscription needs text or title.");
            // RSS alone cannot identify media, so honor explicit media folders/types/hosts.
            const addresses = [outline.htmlUrl, outline.xmlUrl].filter(Boolean);
            if (
                addresses.some((value) => {
                    try {
                        return mediaHost.test(new URL(value as string).hostname);
                    } catch {
                        return false;
                    }
                })
            )
                continue;
            const url = websiteUrl(outline, name);
            const key = url.replace(/\/$/, "");
            if (seen.has(key)) continue;
            seen.add(key);
            blogs.push({ name, url });
        }
    }
    collect(document.opml.body.outline || []);
    return blogs;
}
