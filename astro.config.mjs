import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkImageCaption from "./src/lib/remark-image-caption.ts";
import { remarkSpotifyEmbed } from "./src/lib/remark-spotify-embed.ts";

const astroCommand = globalThis.process?.argv.includes("dev") ? "dev" : "build";
const viteCacheDir = `node_modules/.vite/${astroCommand}`;

export default defineConfig({
    site: "https://haeward.com",
    compressHTML: true,

    integrations: [sitemap(), mdx()],

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
            remarkPlugins: [remarkSpotifyEmbed, remarkImageCaption],
        }),
    },

    output: "static",
});
