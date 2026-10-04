import { createHash } from "node:crypto";
import type { Blog } from "./blogroll";

/** Use the UTC calendar date so each daily deployment gets a fresh order. */
export function blogrollPeriod(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

/** A daily hash rank shuffles presentation without mutating the source export. */
export function orderBlogroll(blogs: Blog[], period: string): Blog[] {
    return blogs
        .map((blog) => ({
            blog,
            rank: createHash("sha256").update(`${period}\0${blog.url}`).digest("hex"),
        }))
        .sort((a, b) => a.rank.localeCompare(b.rank) || a.blog.url.localeCompare(b.blog.url))
        .map(({ blog }) => blog);
}
