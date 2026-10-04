type BlogTocWindow = Window & {
    __blogTocCleanup?: () => void;
};

function syncTableOfContents(): void {
    const globalWindow = window as BlogTocWindow;
    globalWindow.__blogTocCleanup?.();

    const tocContainers = Array.from(document.querySelectorAll("[data-toc-root='true']"));
    const tocProgressRows = Array.from(document.querySelectorAll("[data-toc-progress='true']"));
    const tocProgressLabels = Array.from(
        document.querySelectorAll("[data-toc-progress-label='true']"),
    );

    tocContainers.forEach((container) => {
        if (!(container instanceof HTMLElement)) return;
        container.setAttribute("data-toc-visible", "true");
    });

    tocProgressRows.forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        row.style.setProperty("--blog-toc-progress", "0%");
        row.setAttribute("data-progress", "0");
    });

    tocProgressLabels.forEach((label) => {
        label.textContent = "0%";
    });

    const article = document.querySelector(".blog-article");
    if (!article) return;

    const headings = Array.from(article.querySelectorAll("h2[id], h3[id], h4[id]"));
    const tocLinks = Array.from(document.querySelectorAll("[data-toc-link='true']"));
    if (headings.length === 0 || tocLinks.length === 0) return;

    let activeSlug = "";
    let activeProgress = -1;
    let frameId = 0;
    let observer: IntersectionObserver | null = null;

    const setActiveSlug = (slug: string) => {
        if (slug === activeSlug) return;
        activeSlug = slug;

        tocLinks.forEach((link) => {
            if (!(link instanceof HTMLElement)) return;
            const active = link.dataset.slug === slug;
            link.setAttribute("data-active", String(active));
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });
    };

    const getActiveSlugFromViewport = () => {
        const activationOffset = 140;
        let candidate: Element | null = null;

        for (const heading of headings) {
            const top = heading.getBoundingClientRect().top;
            if (top - activationOffset <= 0) {
                candidate = heading;
                continue;
            }

            if (!candidate && top <= window.innerHeight * 0.6) {
                candidate = heading;
            }
            break;
        }

        return candidate?.id ?? headings[0]?.id ?? "";
    };

    const setActiveSlugFromHash = () => {
        let hashSlug = "";
        try {
            hashSlug = decodeURIComponent(window.location.hash.slice(1));
        } catch {
            return false;
        }
        if (!hashSlug) return false;

        const hashedHeading = headings.find((heading) => heading.id === hashSlug);
        if (!hashedHeading) return false;

        setActiveSlug(hashedHeading.id);
        return true;
    };

    const getArticleProgress = () => {
        const articleRect = article.getBoundingClientRect();
        const scrollSpan = articleRect.height - window.innerHeight;

        if (scrollSpan <= 0) {
            return articleRect.bottom <= window.innerHeight ? 100 : 0;
        }

        const consumedDistance = Math.min(Math.max(-articleRect.top, 0), scrollSpan);
        return (consumedDistance / scrollSpan) * 100;
    };

    const setArticleProgress = (nextProgress: number) => {
        const roundedProgress = Math.round(nextProgress);
        if (roundedProgress === activeProgress) return;

        activeProgress = roundedProgress;
        const progressValue = `${roundedProgress}%`;
        const isTocVisible = true;

        tocContainers.forEach((container) => {
            if (!(container instanceof HTMLElement)) return;
            container.setAttribute("data-toc-visible", isTocVisible ? "true" : "false");
        });

        tocProgressRows.forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            row.style.setProperty("--blog-toc-progress", progressValue);
            row.setAttribute("data-progress", String(roundedProgress));
        });

        tocProgressLabels.forEach((label) => {
            label.textContent = progressValue;
        });
    };

    const updateTableOfContentsState = () => {
        frameId = 0;
        setActiveSlug(getActiveSlugFromViewport());
        setArticleProgress(getArticleProgress());
    };

    const requestUpdate = () => {
        if (frameId) return;
        frameId = window.requestAnimationFrame(updateTableOfContentsState);
    };

    const handleHashChange = () => {
        if (setActiveSlugFromHash()) requestUpdate();
    };

    if (typeof IntersectionObserver === "function")
        observer = new IntersectionObserver(
            () => {
                requestUpdate();
            },
            {
                rootMargin: "-15% 0px -55% 0px",
                threshold: [0, 1],
            },
        );

    headings.forEach((heading) => {
        observer?.observe(heading);
    });
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("scroll", requestUpdate, { passive: true });

    if (!setActiveSlugFromHash()) {
        requestUpdate();
    }

    globalWindow.__blogTocCleanup = () => {
        if (frameId) {
            window.cancelAnimationFrame(frameId);
            frameId = 0;
        }
        observer?.disconnect();
        window.removeEventListener("hashchange", handleHashChange);
        window.removeEventListener("resize", requestUpdate);
        window.removeEventListener("scroll", requestUpdate);
    };
}

document.addEventListener("astro:before-swap", () => {
    (window as BlogTocWindow).__blogTocCleanup?.();
});
document.addEventListener("DOMContentLoaded", syncTableOfContents);
document.addEventListener("astro:page-load", syncTableOfContents);

export {};
