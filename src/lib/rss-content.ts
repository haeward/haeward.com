import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";

/** Resolve relative references against the article, without rewriting prose. */
export function portableRssContent(html: string, articleUrl: URL): string {
    const tree = fromHtml(html, { fragment: true });
    const absolute = (value: string): string => {
        try {
            return new URL(value, articleUrl).href;
        } catch {
            return value;
        }
    };
    visit(tree, "element", (node) => {
        for (const attribute of ["href", "src", "poster"]) {
            const value = node.properties[attribute];
            if (typeof value === "string") node.properties[attribute] = absolute(value);
        }
        const srcset = node.properties.srcSet;
        if (typeof srcset === "string" && !srcset.includes("data:")) {
            node.properties.srcSet = srcset
                .split(",")
                .map((candidate) => {
                    const [url, ...descriptor] = candidate.trim().split(/\s+/);
                    return [absolute(url), ...descriptor].join(" ");
                })
                .join(", ");
        }
    });
    return toHtml(tree);
}
