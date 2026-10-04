import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
    loader: glob({
        base: "./src/content/blog",
        pattern: "**/*.{md,mdx}",
    }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.coerce.date(),
        draft: z.boolean().optional(),
        mastodonUrl: z.url({ protocol: /^https$/ }).optional(),
        og: z.string().optional(),
        ogAlt: z.string().optional(),
        lang: z.string().default("en"),
    }),
});

export const collections = { blog };
