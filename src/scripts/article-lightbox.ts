import { UI } from "../lib/ui";
import { containDialogFocus } from "./dialog-focus";

function setupImageLightbox(): void {
    const article = document.querySelector(".blog-article");
    const dialog = document.querySelector<HTMLDialogElement>("#image-lightbox");
    if (!article || !dialog || article.hasAttribute("data-lightbox-bound")) return;
    const image = dialog.querySelector<HTMLImageElement>(".image-lightbox__img");
    const caption = dialog.querySelector<HTMLElement>(".image-lightbox__caption");
    const status = dialog.querySelector<HTMLElement>(".image-lightbox__status");
    const original = dialog.querySelector<HTMLAnchorElement>(".image-lightbox__original");
    const retry = dialog.querySelector<HTMLButtonElement>("[data-image-retry]");
    const stage = dialog.querySelector<HTMLElement>(".image-lightbox__stage");
    if (!image || !caption || !status || !original || !retry || !stage) return;
    article.setAttribute("data-lightbox-bound", "true");
    let trigger: HTMLAnchorElement | null = null;
    let source: HTMLImageElement | null = null;
    let pending: HTMLImageElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request = 0;

    const cancel = () => {
        request++;
        clearTimeout(timer);
        if (pending) {
            pending.onload = null;
            pending.onerror = null;
            pending.removeAttribute("srcset");
            pending.removeAttribute("src");
            pending = null;
        }
    };
    const load = () => {
        if (!source || !trigger) return;
        cancel();
        const id = request;
        const candidate = new Image();
        pending = candidate;
        retry.hidden = true;
        status.textContent = UI.loadingImage;
        dialog.classList.remove("is-error");
        dialog.classList.add("is-loading");
        const failed = () => {
            if (id !== request || !dialog.open) return;
            cancel();
            dialog.classList.remove("is-loading");
            dialog.classList.add("is-error");
            status.textContent = dialog.classList.contains("is-ready")
                ? UI.imagePreviewFailed
                : UI.imageFailed;
            retry.hidden = false;
        };
        candidate.onload = async () => {
            try {
                await candidate.decode();
                if (id !== request || !dialog.open) return;
                clearTimeout(timer);
                image.width = candidate.naturalWidth;
                image.height = candidate.naturalHeight;
                image.src = candidate.currentSrc || candidate.src;
                dialog.classList.remove("is-loading", "is-error");
                dialog.classList.add("is-ready");
                status.textContent = "";
                pending = null;
            } catch {
                failed();
            }
        };
        candidate.onerror = failed;
        timer = setTimeout(failed, 15000);
        // The browser chooses a DPR-aware size for the actual fitted image,
        // instead of downloading the unbounded original on every open.
        if (source.srcset) {
            const width = Number(source.getAttribute("width")) || source.naturalWidth;
            const height = Number(source.getAttribute("height")) || source.naturalHeight;
            const bounds = stage.getBoundingClientRect();
            const fittedWidth =
                width && height
                    ? Math.min(bounds.width, (bounds.height * width) / height)
                    : bounds.width;
            candidate.sizes = `${Math.max(1, Math.ceil(fittedWidth))}px`;
            candidate.srcset = source.srcset;
            candidate.src = source.src;
        } else {
            candidate.src = trigger.href;
        }
    };
    const close = () => {
        cancel();
        image.removeAttribute("src");
        dialog.classList.remove("is-open", "is-ready", "is-loading", "is-error");
        document.documentElement.classList.remove("image-lightbox-open");
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    article.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const link = event.target.closest<HTMLAnchorElement>("[data-image-zoom]");
        if (!link || !(event instanceof MouseEvent)) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const thumbnail = link.querySelector("img");
        if (!thumbnail) return;
        event.preventDefault();
        trigger = link;
        source = thumbnail;
        original.href = link.href;
        image.alt = source.alt;
        const width = Number(source.getAttribute("width")) || source.naturalWidth;
        const height = Number(source.getAttribute("height")) || source.naturalHeight;
        dialog.style.setProperty("--image-ratio", String(width && height ? width / height : 1));
        caption.textContent = source.alt;
        caption.hidden = !source.alt;
        dialog.classList.remove("is-ready", "is-error");
        // Reuse already decoded content while a sharper candidate is loading.
        if (source.complete && source.naturalWidth > 0) {
            image.width = source.naturalWidth;
            image.height = source.naturalHeight;
            image.src = source.currentSrc || source.src;
            dialog.classList.add("is-ready");
        }
        dialog.classList.add("is-open");
        document.documentElement.classList.add("image-lightbox-open");
        dialog.showModal();
        load();
    });
    retry.addEventListener("click", load);
    dialog.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("[data-close]")) dialog.close();
    });
    dialog.addEventListener("close", close);
    dialog.addEventListener("keydown", (event) => containDialogFocus(event, dialog));
    document.addEventListener(
        "astro:before-swap",
        () => {
            if (dialog.open) dialog.close();
            cancel();
            document.documentElement.classList.remove("image-lightbox-open");
        },
        { once: true },
    );
}

document.addEventListener("DOMContentLoaded", setupImageLightbox);
document.addEventListener("astro:page-load", setupImageLightbox);
setupImageLightbox();
