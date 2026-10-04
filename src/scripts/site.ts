import { UI } from "../lib/ui";
import "./link-enhancer";

type Theme = "dark" | "light";
type SiteWindow = Window & {
    __siteState?: { bound: boolean; theme: Theme; storageFailed?: boolean };
    __edgeFadeCleanup?: () => void;
};
const globalWindow = window as SiteWindow;
globalWindow.__siteState ??= {
    bound: false,
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
};
const state = globalWindow.__siteState;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let focusNewPage = false;
let initializedBody: HTMLElement | undefined;
const nextTheme: Record<Theme, Theme> = { dark: "light", light: "dark" };

function getTheme(): Theme {
    if (state.storageFailed) return state.theme;
    try {
        const stored = localStorage.getItem("theme");
        if (stored === "light" || stored === "dark") {
            state.theme = stored;
        } else {
            localStorage.setItem("theme", state.theme);
        }
    } catch {
        state.storageFailed = true;
    }
    return state.theme;
}

function syncTheme(): void {
    const theme = getTheme();
    const root = document.documentElement;
    root.dataset.themeMode = theme;
    if (root.classList.contains("dark") !== (theme === "dark")) {
        root.classList.add("theme-changing");
        root.classList.toggle("dark", theme === "dark");
        void document.body.offsetHeight;
        root.classList.remove("theme-changing");
    }
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    button.dataset.themeToggleMode = nextTheme[theme];
    const label = `Theme: ${theme}. Switch to ${nextTheme[theme]}`;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
}

function prepareCode(): void {
    document.querySelectorAll<HTMLElement>("article pre").forEach((pre) => {
        if (pre.closest(".code-block")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "code-block";
        const toolbar = document.createElement("div");
        toolbar.className = "code-block__toolbar";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-copy";
        button.textContent = UI.copyCode;
        const status = document.createElement("span");
        status.className = "code-copy__status";
        status.setAttribute("role", "status");
        const wrap = document.createElement("button");
        wrap.type = "button";
        wrap.className = "code-wrap";
        wrap.textContent = UI.wrap;
        wrap.setAttribute("aria-pressed", "false");
        wrap.addEventListener("click", () => {
            const enabled = wrapper.classList.toggle("code-block--wrap");
            wrap.setAttribute("aria-pressed", String(enabled));
        });
        toolbar.append(status, wrap, button);
        pre.before(wrapper);
        wrapper.append(toolbar, pre);
        pre.tabIndex = 0;
        button.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(
                    pre.querySelector("code")?.textContent ?? pre.textContent ?? "",
                );
                status.textContent = UI.copied;
            } catch {
                status.textContent = UI.copyFailed;
            }
        });
    });
}

function initEdgeFades(): void {
    globalWindow.__edgeFadeCleanup?.();
    const topFade = document.querySelector<HTMLElement>(".site-edge-fade--top");
    const bottomFade = document.querySelector<HTMLElement>(".site-edge-fade--bottom");
    if (!topFade || !bottomFade) return;

    let frame = 0;
    const update = () => {
        frame = 0;
        const root = document.documentElement;
        const scrollRange = Math.max(0, root.scrollHeight - root.clientHeight);
        const scrolled = Math.min(scrollRange, Math.max(0, window.scrollY));
        const remaining = scrollRange - scrolled;
        // Allow for fractional positions and elastic overscroll at either document edge.
        const topOpacity = scrolled <= 1 ? 0 : Math.min(scrolled / (topFade.offsetHeight || 88), 1);
        const bottomOpacity =
            remaining <= 1 ? 0 : Math.min(remaining / (bottomFade.offsetHeight || 88), 1);
        topFade.style.opacity = String(topOpacity);
        bottomFade.style.opacity = String(bottomOpacity);
    };
    const requestUpdate = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(requestUpdate);
    observer.observe(document.body);
    observer.observe(document.documentElement);
    document.querySelectorAll("main, footer").forEach((node) => {
        observer.observe(node);
    });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pageshow", requestUpdate);
    update();

    globalWindow.__edgeFadeCleanup = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("scroll", requestUpdate);
        window.removeEventListener("resize", requestUpdate);
        window.removeEventListener("pageshow", requestUpdate);
        globalWindow.__edgeFadeCleanup = undefined;
    };
}

function init(): void {
    if (initializedBody === document.body) return;
    initializedBody = document.body;
    syncTheme();
    document.documentElement.classList.toggle("scrolled", window.scrollY > 0);
    prepareCode();
    document.querySelectorAll<HTMLElement>(".table-scroll").forEach((node) => {
        node.setAttribute("aria-label", UI.table);
    });
    document.querySelectorAll("[data-js-control]").forEach((node) => {
        node.removeAttribute("hidden");
    });
    initEdgeFades();
}

if (!state.bound) {
    state.bound = true;
    document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest("#theme-toggle")) {
            state.theme = nextTheme[getTheme()];
            try {
                localStorage.setItem("theme", state.theme);
            } catch {
                state.storageFailed = true;
            }
            syncTheme();
        }
        if (event.target.closest("#back-to-top")) {
            window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "instant" : "smooth" });
        }
    });
    window.addEventListener("storage", (event) => {
        if (event.key === null || event.key === "theme") syncTheme();
    });
    window.addEventListener(
        "scroll",
        () => {
            document.documentElement.classList.toggle("scrolled", window.scrollY > 0);
        },
        { passive: true },
    );
    document.addEventListener("astro:before-preparation", (event) => {
        focusNewPage =
            event.navigationType !== "traverse" && event.from.pathname !== event.to.pathname;
    });
    document.addEventListener("astro:before-swap", () => globalWindow.__edgeFadeCleanup?.());
    document.addEventListener("astro:page-load", () => {
        if (!focusNewPage) return;
        focusNewPage = false;
        let target: HTMLElement | null = null;
        try {
            target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        } catch {
            /* Invalid hashes are harmless. */
        }
        target ??= document.getElementById("main-content");
        if (target && !target.hasAttribute("tabindex")) target.tabIndex = -1;
        target?.focus({ preventScroll: true });
    });
    document.addEventListener("DOMContentLoaded", init);
    document.addEventListener("astro:page-load", init);
    document.addEventListener("astro:after-swap", init);
}
init();
