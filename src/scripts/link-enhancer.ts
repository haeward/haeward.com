import { UI } from "../lib/ui";

function enhanceLinks(): void {
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        try {
            const url = new URL(link.href, location.href);
            const external =
                ["http:", "https:"].includes(url.protocol) && url.origin !== location.origin;
            link.dataset.external = String(external);
            // Preserve normal navigation and the author's accessible link text.
            if (link.target === "_blank") {
                link.relList.add("noopener", "noreferrer");
                if (
                    !link.hasAttribute("data-new-window") &&
                    !link.querySelector("[data-new-window]")
                ) {
                    const hint = document.createElement("span");
                    hint.className = "sr-only";
                    hint.dataset.newWindow = "true";
                    hint.textContent = UI.newTab;
                    if (link.hasAttribute("aria-label")) {
                        link.setAttribute(
                            "aria-label",
                            link.getAttribute("aria-label") + UI.newTab,
                        );
                        link.dataset.newWindow = "true";
                    } else link.append(hint);
                }
            }
        } catch {
            /* Ignore malformed author URLs without interrupting the page. */
        }
    });
}

document.addEventListener("DOMContentLoaded", enhanceLinks);
document.addEventListener("astro:page-load", enhanceLinks);
enhanceLinks();
