import { loadRenderers } from "astro:container";
import { render } from "astro:content";
import { getContainerRenderer as getMDXRenderer } from "@astrojs/mdx/container-renderer";
import rss from "@astrojs/rss";
import { SITE } from "@consts";
import { getPublishedPosts } from "@lib/posts";
import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

export async function GET(context: APIContext) {
    const renderers = await loadRenderers([getMDXRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const siteUrl = context.site ?? new URL(context.request.url).origin;
    const feedUrl = new URL("/rss.xml", siteUrl).href;
    const feedImageUrl = new URL("/assets/images/site/favicon.png", siteUrl).href;
    const homeUrl = new URL("/", siteUrl).href;

    const posts = await getPublishedPosts();

    const items = await Promise.all(
        posts.map(async (post) => {
            const { Content } = await render(post);
            const html = await container.renderToString(Content);

            return {
                title: post.data.title,
                description: post.data.description,
                content: html,
                pubDate: post.data.date,
                link: `/posts/${post.id}/`,
            };
        }),
    );

    return rss({
        title: SITE.NAME,
        description: SITE.DESC,
        site: siteUrl,
        items: items,
        stylesheet: "/feed/pretty-feed.xsl",
        xmlns: {
            atom: "http://www.w3.org/2005/Atom",
        },

        customData: `
      <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
      <atom:icon>${feedImageUrl}</atom:icon>
      <atom:logo>${feedImageUrl}</atom:logo>
      <image>
        <url>${feedImageUrl}</url>
        <title>${SITE.NAME}</title>
        <link>${homeUrl}</link>
      </image>
      <follow_challenge>
        <feedId>136093735733238784</feedId>
        <userId>55205286935703552</userId>
      </follow_challenge>
    `,
    });
}
