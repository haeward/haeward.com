import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;
type BlogPostGroups = Record<string, BlogPost[]>;

export async function getPublishedPosts(): Promise<BlogPost[]> {
    const posts = await getCollection("blog");

    return posts
        .filter((post) => !post.data.draft)
        .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function groupPostsByYear(posts: BlogPost[]): BlogPostGroups {
    return posts.reduce<BlogPostGroups>((groups, post) => {
        const year = post.data.date.getUTCFullYear().toString();
        groups[year] ??= [];
        groups[year].push(post);
        return groups;
    }, {});
}
