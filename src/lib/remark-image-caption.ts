import type { Html, Image, Paragraph, Parent, Root } from "mdast";
import { visit } from "unist-util-visit";
import imageDimensions from "../data/article-images.json";

type ImageDimensions = {
    width: number;
    height: number;
    variants?: { requestWidth?: number; src?: string; width: number; height: number }[];
};
const ARTICLE_IMAGE_SIZES = "(max-width: 760px) calc(100vw - 40px), 720px";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function supportsResponsiveWidths(rawUrl: string): boolean {
    try {
        const url = new URL(rawUrl);
        return url.hostname === "webp.haeward.com";
    } catch {
        return false;
    }
}

function withWidth(rawUrl: string, width: number): string {
    const url = new URL(rawUrl);
    url.searchParams.set("width", String(width));
    return url.toString();
}

function buildImageMarkup(imageNode: Image, firstImage: boolean): string {
    const altText = imageNode.alt?.trim() ?? "";
    const escapedAlt = escapeHtml(altText);
    const responsive = supportsResponsiveWidths(imageNode.url);
    const dimensions = (imageDimensions as Record<string, ImageDimensions>)[imageNode.url];
    const variants = (dimensions?.variants ?? []).flatMap((variant) => {
        const src =
            variant.src ??
            (responsive && variant.requestWidth
                ? withWidth(imageNode.url, variant.requestWidth)
                : undefined);
        return src ? [{ ...variant, src }] : [];
    });
    const fallback = variants.find((variant) => variant.width >= 720) ?? variants.at(-1);
    const src = fallback?.src ?? imageNode.url;
    const srcset = variants
        .map((variant) => `${escapeHtml(variant.src)} ${variant.width}w`)
        .join(", ");
    // Portraits are height-limited in the article; don't download a full-column
    // image when only a narrow, fitted portrait will actually be displayed.
    const sizes = dimensions
        ? `min(calc(100vw - 40px), 720px, ${((72 * dimensions.width) / dimensions.height).toFixed(2)}vh, ${((672 * dimensions.width) / dimensions.height).toFixed(2)}px)`
        : ARTICLE_IMAGE_SIZES;
    // A fitted link with an auto-width image otherwise collapses until decoding,
    // even when the img has width/height attributes. Reserve the final fitted box.
    const frameStyle = dimensions
        ? ` style="--article-image-width: min(100%, ${Math.min(720, dimensions.width)}px, ${((72 * dimensions.width) / dimensions.height).toFixed(2)}vh, ${((672 * dimensions.width) / dimensions.height).toFixed(2)}px); --article-image-ratio: ${dimensions.width} / ${dimensions.height}; --article-image-height: 100%"`
        : "";
    const attributes = [
        `class="blog-figure__image"`,
        `src="${escapeHtml(src)}"`,
        `alt="${escapedAlt}"`,
        `loading="${firstImage ? "eager" : "lazy"}"`,
        `decoding="async"`,
    ];
    if (firstImage) attributes.push(`fetchpriority="high"`);

    if (dimensions) {
        attributes.push(`width="${dimensions.width}"`, `height="${dimensions.height}"`);
    }

    if (srcset) {
        attributes.push(`srcset="${srcset}"`);
        attributes.push(`sizes="${sizes}"`);
    }

    return `<figure class="blog-figure">
            <a href="${escapeHtml(imageNode.url)}" data-image-zoom="true" data-astro-prefetch="false" aria-label="${escapedAlt} — Open image"${frameStyle}><img ${attributes.join(" ")} /></a>
            <figcaption class="blog-figure__caption">${escapedAlt}</figcaption>
          </figure>`;
}

const remarkImageCaption = () => {
    return (tree: Root) => {
        const replacements: Array<{ index: number; parent: Parent; newNode: Html }> = [];
        let firstImage = true;

        visit(
            tree,
            "paragraph",
            (node: Paragraph, index: number | undefined, parent: Parent | undefined) => {
                if (!parent || typeof index === "undefined") return;

                if (node.children.length === 1 && node.children[0].type === "image") {
                    const imageNode = node.children[0] as Image;

                    if (imageNode.alt && imageNode.alt.trim() !== "") {
                        const figureNode: Html = {
                            type: "html",
                            value: buildImageMarkup(imageNode, firstImage),
                        };
                        firstImage = false;

                        replacements.push({ index, parent, newNode: figureNode });
                    }
                }
            },
        );

        // Apply replacements in reverse order to avoid index shifting
        replacements.reverse().forEach(({ index, parent, newNode }) => {
            parent.children.splice(index, 1, newNode);
        });
    };
};

export default remarkImageCaption;
