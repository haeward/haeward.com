import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeReading from "./src/lib/rehype-reading.ts";
import remarkImageCaption from "./src/lib/remark-image-caption.ts";
import { remarkSpotifyEmbed } from "./src/lib/remark-spotify-embed.ts";
import remarkWorkQuote from "./src/lib/remark-work-quote.ts";

const astroCommand = globalThis.process?.argv.includes("dev") ? "dev" : "build";
const viteCacheDir = `node_modules/.vite/${astroCommand}`;
const site = "https://haeward.com";

export default defineConfig({
    site,
    compressHTML: true,

    integrations: [
        sitemap({
            filter: (page) => {
                const pathname = new URL(page).pathname;
                return !pathname.startsWith("/media/data/") && !pathname.startsWith("/404");
            },
        }),
        mdx(),
    ],

    vite: {
        cacheDir: viteCacheDir,
        plugins: [tailwindcss()],
    },

    markdown: {
        syntaxHighlight: "shiki",
        shikiConfig: {
            themes: {
                light: "min-light",
                dark: "dracula-soft",
            },
            defaultColor: false,
            wrap: true,
        },
        processor: unified({
            remarkPlugins: [remarkSpotifyEmbed, remarkWorkQuote, remarkImageCaption],
            rehypePlugins: [rehypeHeadingIds, [rehypeReading, { site }]],
        }),
    },

    prefetch: {
        prefetchAll: true,
        defaultStrategy: "hover",
    },

    output: "static",
});
