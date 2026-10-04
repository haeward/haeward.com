import type { Blockquote, Paragraph, Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";

/** [!QUOTE] or [!QUOTE center]; the final > — … paragraph is attribution. */
export default function remarkWorkQuote() {
    return (tree: Root) => {
        visit(tree, "blockquote", (node: Blockquote) => {
            const marker = node.children[0];
            if (
                marker?.type !== "paragraph" ||
                marker.children.length !== 1 ||
                marker.children[0].type !== "text" ||
                node.children.length < 2
            )
                return;
            const match = /^\[!QUOTE(?: (center))?\]$/.exec(marker.children[0].value.trim());
            if (!match) return;

            const content = node.children.slice(1);
            const last = content.at(-1);
            let attribution: Paragraph | undefined;
            if (
                last?.type === "paragraph" &&
                last.children[0]?.type === "text" &&
                /^—\s+/.test(last.children[0].value) &&
                content.length > 1
            ) {
                attribution = last;
                attribution.data = { hName: "figcaption" };
                content.pop();
            }
            node.data = {
                hName: "figure",
                hProperties: {
                    className: match[1]
                        ? ["literary-quote", "literary-quote--center"]
                        : ["literary-quote"],
                },
            };
            node.children = [{ type: "blockquote", children: content }];
            if (attribution) node.children.push(attribution);
            return SKIP;
        });
    };
}
