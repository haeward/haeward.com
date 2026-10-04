type Node = {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: Node[];
    value?: string;
};

function containsMedia(node: Node): boolean {
    return (
        ["img", "picture", "svg"].includes(node.tagName || "") ||
        Boolean(node.children?.some(containsMedia))
    );
}

function decorateLink(node: Node, site?: string): void {
    const href = node.properties?.href;
    if (typeof href !== "string" || !site || containsMedia(node)) return;
    try {
        const url = new URL(href, site);
        if (!["https:", "http:"].includes(url.protocol) || url.origin === new URL(site).origin)
            return;
        if (node.properties?.dataExternalDecorated) return;
        node.properties = {
            ...node.properties,
            dataExternal: "true",
            dataExternalDecorated: "true",
        };
        const decoration = (className: string): Node => ({
            type: "element",
            tagName: "span",
            properties: { className: [className], ariaHidden: "true", dataPagefindIgnore: "true" },
            children: [],
        });
        node.children?.push(decoration("prose-external-arrow"));
    } catch {
        // Invalid author URLs remain ordinary links.
    }
}

// Wrappers are generated with the document so wide content works without JS.
export default function rehypeReading(options: { site?: string } = {}) {
    return (tree: Node) => {
        function walk(parent: Node): void {
            parent.children = parent.children?.map((node) => {
                const classes = node.properties?.className;
                if (
                    ["pre", "code"].includes(node.tagName || "") ||
                    (Array.isArray(classes) && classes.includes("not-prose"))
                )
                    return node;
                walk(node);
                if (node.tagName === "a") decorateLink(node, options.site);
                if (node.tagName === "th") {
                    node.properties = { ...node.properties, scope: "col" };
                }
                if (node.tagName === "td") {
                    const text =
                        node.children
                            ?.map((child) => child.value || "")
                            .join("")
                            .trim() || "";
                    if (/^(?:[¥￥$€£]\s*)?\d[\d.,\s/%¥￥$€£-]*$/.test(text)) {
                        node.properties = { ...node.properties, className: ["numeric-cell"] };
                    }
                }
                if (node.tagName !== "table") return node;
                return {
                    type: "element",
                    tagName: "div",
                    properties: {
                        className: ["table-scroll"],
                        tabIndex: 0,
                        role: "region",
                        ariaLabel: "Scrollable table",
                    },
                    children: [node],
                };
            });
        }
        walk(tree);
    };
}
