import { UI } from "../lib/ui";
import { containDialogFocus } from "./dialog-focus";
import { escapeAttribute, escapeHtml } from "./html";
import { withTimeout } from "./timeout";

type SearchView = "idle" | "loading" | "unavailable" | "empty" | "results" | "outdated";

type SearchResult = {
    title: string;
    date: string;
    href: string;
    excerpt: string;
};

type SearchRefs = {
    root: HTMLDialogElement | null;
    input: HTMLInputElement | null;
    summary: HTMLElement | null;
    content: HTMLElement | null;
};

type SearchBatch = {
    term: string;
    matches: NonNullable<PagefindSearch["results"]>;
    entries: PromiseSettledResult<SearchResult | null>[];
};

type SearchState = {
    bound: boolean;
    refs: SearchRefs | null;
    open: boolean;
    query: string;
    results: SearchResult[];
    view: SearchView;
    summary: string;
    lastTrigger: Element | null;
    searchToken: number;
    pagefind: PagefindInstance | null;
    pagefindPromise: Promise<PagefindInstance | null> | null;
    missingIndex: boolean;
    indexSignature: string | null;
    batch?: SearchBatch | null;
};

type PagefindLanguageMap = Record<string, { page_count?: number }>;

type PagefindModule = {
    default?: PagefindInstance | { createInstance?: () => PagefindInstance };
    createInstance?: () => PagefindInstance;
};

type PagefindInstance = {
    init?: () => Promise<void>;
    mergeIndex?: (bundlePath: string, options: { language: string }) => Promise<void>;
    search: (term: string) => Promise<PagefindSearch | null>;
};

type PagefindSearch = {
    results?: Array<{ data: () => Promise<PagefindEntry> }>;
};

type PagefindEntry = {
    url?: string;
    excerpt?: string;
    meta?: {
        title?: string;
        date?: string;
    };
    sub_results?: Array<{
        url?: string;
        excerpt?: string;
    }>;
};

type SearchWindow = Window & {
    __searchModalState?: SearchState;
};

const globalWindow = window as SearchWindow;
globalWindow.__searchModalState ??= {
    bound: false,
    refs: null,
    open: false,
    query: "",
    results: [],
    view: "idle",
    summary: "",
    lastTrigger: null,
    searchToken: 0,
    pagefind: null,
    pagefindPromise: null,
    missingIndex: false,
    indexSignature: null,
    batch: null,
};

const searchModalState = globalWindow.__searchModalState;
let inputTimer: ReturnType<typeof setTimeout> | undefined;
let composing = false;
let resultLimit = 8;
let indexAttempt = 0;

function initSearchModal(): void {
    searchModalState.refs = {
        root: document.getElementById("site-search") as HTMLDialogElement | null,
        input: document.getElementById("site-search-input") as HTMLInputElement | null,
        summary: document.getElementById("site-search-summary"),
        content: document.getElementById("site-search-content"),
    };

    if (
        !searchModalState.refs.root ||
        !searchModalState.refs.input ||
        !searchModalState.refs.summary ||
        !searchModalState.refs.content
    ) {
        return;
    }

    searchModalState.refs.input.value = searchModalState.query;

    if (searchModalState.open) {
        closeSearch({ restoreFocus: false });
    } else {
        document.documentElement.classList.remove("search-open");
        renderSearchModal();
    }
}

function bindSearchModal(): void {
    if (searchModalState.bound) return;
    searchModalState.bound = true;

    document.addEventListener("click", handleSearchModalClick);
    document.addEventListener("keydown", handleSearchModalKeydown);
    document.addEventListener("input", handleSearchModalInput);
    document.addEventListener("compositionstart", (event) => {
        if ((event.target as HTMLElement)?.id === "site-search-input") {
            composing = true;
            clearTimeout(inputTimer);
            searchModalState.searchToken += 1;
        }
    });
    document.addEventListener("compositionend", (event) => {
        composing = false;
        handleSearchModalInput(event);
    });
    document.addEventListener("astro:before-swap", () => closeSearch({ restoreFocus: false }));
    document.addEventListener("astro:after-swap", initSearchModal);
}

function handleSearchModalClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;

    const trigger = event.target.closest("[data-search-trigger='true']");
    if (trigger) {
        event.preventDefault();
        if (searchModalState.open) {
            closeSearch();
        } else {
            openSearch(trigger);
        }
        return;
    }

    if (event.target.closest("[data-search-retry]")) {
        indexAttempt += 1;
        searchModalState.missingIndex = false;
        searchModalState.pagefind = null;
        if (searchModalState.query) void searchArticles(searchModalState.query);
        else {
            searchModalState.view = "idle";
            renderSearchModal();
        }
        return;
    }
    if (event.target.closest("[data-search-more]")) {
        if (
            searchModalState.view !== "results" ||
            searchModalState.batch?.term !== searchModalState.query
        )
            return;
        resultLimit += 8;
        void searchArticles(searchModalState.query, true);
        return;
    }
    const closeTarget = event.target.closest("[data-search-close='true']");
    if (closeTarget && searchModalState.open) {
        event.preventDefault();
        closeSearch();
        return;
    }

    const resultLink = event.target.closest("[data-search-result-link='true']");
    if (resultLink && searchModalState.open) {
        closeSearch({ restoreFocus: false });
    }
}

function handleSearchModalKeydown(event: KeyboardEvent): void {
    if (searchModalState.open && searchModalState.refs?.root) {
        containDialogFocus(event, searchModalState.refs.root);
        if (event.defaultPrevented) return;
    }
    if (event.key === "Escape" && searchModalState.open) {
        event.preventDefault();
        closeSearch();
        return;
    }

    const isShortcut =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
    if (!isShortcut) return;
    if (isEditableTarget(event.target)) return;

    event.preventDefault();

    if (searchModalState.open) {
        closeSearch();
    } else {
        openSearch(document.querySelector("[data-search-trigger='true']"));
    }
}

function handleSearchModalInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== "site-search-input") {
        return;
    }

    if (composing || (event instanceof InputEvent && event.isComposing)) return;
    clearTimeout(inputTimer);
    searchModalState.searchToken += 1;
    resultLimit = 8;
    const term = event.target.value.trim();
    searchModalState.query = term;

    if (!term) {
        searchModalState.searchToken += 1;
        searchModalState.results = [];
        searchModalState.summary = "";
        searchModalState.view = searchModalState.missingIndex ? "unavailable" : "idle";
        renderSearchModal();
        return;
    }

    inputTimer = setTimeout(() => void searchArticles(term), 160);
}

function openSearch(trigger: Element | null): void {
    const refs = searchModalState.refs;
    if (!refs?.root || !refs.input) return;

    searchModalState.open = true;
    searchModalState.lastTrigger =
        trigger instanceof HTMLElement ? trigger : document.activeElement;

    refs.root.hidden = false;
    refs.root.showModal();
    document.documentElement.classList.add("search-open");
    refs.input.value = searchModalState.query;
    renderSearchModal();
    refs.input.focus({ preventScroll: true });
    refs.input.select();
    if (searchModalState.query) void searchArticles(searchModalState.query);
}

function closeSearch({ restoreFocus = true } = {}): void {
    const refs = searchModalState.refs;
    if (!refs?.root) return;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && refs.root.contains(activeElement)) {
        activeElement.blur();
    }

    clearTimeout(inputTimer);
    searchModalState.searchToken += 1;
    if (searchModalState.view === "loading") searchModalState.view = "idle";
    searchModalState.open = false;
    refs.root.close();
    refs.root.hidden = true;
    document.documentElement.classList.remove("search-open");

    if (restoreFocus && searchModalState.lastTrigger instanceof HTMLElement) {
        searchModalState.lastTrigger.focus({ preventScroll: true });
    }
}

class IndexChangedError extends Error {}

type IndexSnapshot = { languages: PagefindLanguageMap; signature: string; key: string };
async function ensurePagefind(snapshot: IndexSnapshot): Promise<PagefindInstance | null> {
    if (searchModalState.pagefind) return searchModalState.pagefind;
    if (searchModalState.missingIndex) return null;
    if (searchModalState.pagefindPromise) return searchModalState.pagefindPromise;

    searchModalState.pagefindPromise = (async () => {
        try {
            // A failed dynamic import is cached by URL for the lifetime of the page.
            const pagefindPath = `/pagefind/pagefind.js?v=${snapshot.key}&retry=${indexAttempt}`;
            const imported = (await withTimeout(
                import(/* @vite-ignore */ pagefindPath),
            )) as PagefindModule;
            const pagefindModule = imported?.default ?? imported;
            const pagefind =
                "createInstance" in pagefindModule &&
                typeof pagefindModule.createInstance === "function"
                    ? pagefindModule.createInstance()
                    : (pagefindModule as PagefindInstance);
            const languages = snapshot.languages;

            if (typeof pagefind.init === "function") {
                await withTimeout(pagefind.init());
            }

            await withTimeout(mergePagefindLanguages(pagefind, languages));
            await assertCurrentIndex(snapshot.signature);
            searchModalState.indexSignature = snapshot.signature;
            searchModalState.pagefind = pagefind;
            return pagefind;
        } catch (error) {
            if (error instanceof IndexChangedError) throw error;
            searchModalState.missingIndex = true;
            if (!searchModalState.query) {
                searchModalState.view = "unavailable";
                renderSearchModal();
            }
            return null;
        } finally {
            searchModalState.pagefindPromise = null;
        }
    })();

    return searchModalState.pagefindPromise;
}

async function loadIndexSnapshot(): Promise<IndexSnapshot> {
    const response = await fetch("/pagefind/pagefind-entry.json", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
    });
    if (!response.ok) throw new Error("Pagefind entry unavailable");
    const entry = await response.json();
    if (
        !entry ||
        typeof entry.languages !== "object" ||
        !entry.languages ||
        !Object.keys(entry.languages).length
    )
        throw new Error("Invalid Pagefind entry");
    const signature = JSON.stringify(entry);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
    const key = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
    return { languages: entry.languages, signature, key };
}

async function assertCurrentIndex(signature: string): Promise<void> {
    if ((await loadIndexSnapshot()).signature !== signature) throw new IndexChangedError();
}

async function mergePagefindLanguages(
    pagefind: PagefindInstance,
    languages: PagefindLanguageMap,
): Promise<void> {
    if (typeof pagefind.mergeIndex !== "function") return;

    const languageKeys = Object.keys(languages);
    if (languageKeys.length <= 1) {
        return;
    }

    const primaryLanguage = getPrimaryPagefindLanguage(languages);
    const bundlePath = new URL("/pagefind/", window.location.origin).href;
    const languagesToMerge = languageKeys.filter((language) => language !== primaryLanguage);

    await Promise.all(
        languagesToMerge.map((language) => pagefind.mergeIndex?.(bundlePath, { language })),
    );
}

function getPrimaryPagefindLanguage(languages: PagefindLanguageMap): string {
    const languageKeys = Object.keys(languages);
    const pageLanguage = (document.documentElement.getAttribute("lang") || "unknown").toLowerCase();

    if (languages[pageLanguage]) return pageLanguage;

    const baseLanguage = pageLanguage.split("-")[0];
    if (languages[baseLanguage]) return baseLanguage;

    return languageKeys
        .slice()
        .sort(
            (left, right) =>
                (languages[right]?.page_count || 0) - (languages[left]?.page_count || 0),
        )[0];
}

async function searchArticles(term: string, append = false): Promise<void> {
    const token = ++searchModalState.searchToken;
    const batch = append && searchModalState.batch?.term === term ? searchModalState.batch : null;
    const previousResults = batch ? searchModalState.results : undefined;
    if (!batch) searchModalState.batch = null;
    searchModalState.view = "loading";
    searchModalState.summary = "";
    renderSearchModal(previousResults?.length);

    try {
        const snapshot = await loadIndexSnapshot();
        if (token !== searchModalState.searchToken) return;
        if (
            searchModalState.indexSignature &&
            searchModalState.indexSignature !== snapshot.signature
        )
            throw new IndexChangedError();
        let matches = batch?.matches;
        if (!matches) {
            const pagefind = await ensurePagefind(snapshot);
            if (token !== searchModalState.searchToken) return;
            if (!pagefind) throw new Error("Index unavailable");
            const search = await withTimeout(pagefind.search(term));
            if (token !== searchModalState.searchToken) return;
            if (!search) throw new Error("Search unavailable");
            matches = search.results || [];
        }
        const data = await Promise.allSettled(
            matches.slice(0, resultLimit).map((result, index) => {
                const cached = batch?.entries[index];
                return cached?.status === "fulfilled"
                    ? Promise.resolve(cached.value)
                    : withTimeout(result.data()).then(normalizeSearchResult);
            }),
        );
        if (token !== searchModalState.searchToken) return;
        const items = data.flatMap((result) => {
            return result.status === "fulfilled" && result.value ? [result.value] : [];
        });
        if (matches.length && !items.length) throw new Error("Results unavailable");
        await assertCurrentIndex(snapshot.signature);
        if (token !== searchModalState.searchToken) return;
        searchModalState.batch = { term, matches, entries: data };
        searchModalState.results = items;
        searchModalState.summary = items.length
            ? `Showing ${items.length} of ${matches.length} results for “${term}”`
            : "";
        if (data.some((result) => result.status === "rejected"))
            searchModalState.summary += ` ${UI.partial}`;
        searchModalState.view = items.length ? "results" : "empty";
        renderSearchModal(
            previousResults?.every((item, index) => items[index] === item)
                ? previousResults.length
                : undefined,
        );
    } catch (error) {
        if (token !== searchModalState.searchToken) return;
        searchModalState.view = error instanceof IndexChangedError ? "outdated" : "unavailable";
        searchModalState.summary = "";
        renderSearchModal();
    }
}

function normalizeSearchResult(entry: PagefindEntry): SearchResult | null {
    if (!entry?.url) return null;

    const subResult = Array.isArray(entry.sub_results)
        ? entry.sub_results.find((item) => item?.url)
        : null;
    const excerpt = subResult?.excerpt || entry.excerpt || "";

    let target: URL;
    try {
        target = new URL(subResult?.url || entry.url, window.location.origin);
    } catch {
        return null;
    }
    if (target.origin !== window.location.origin || !target.pathname.startsWith("/posts/"))
        return null;
    return {
        title: (entry.meta?.title || UI.untitled).replace(/ \| Haeward$/, ""),
        date: formatSearchDate(entry.meta?.date),
        href: target.href,
        excerpt,
    };
}

function formatSearchDate(value?: string): string {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

function renderSearchModal(appendFrom?: number): void {
    const refs = searchModalState.refs;
    if (!refs?.root || !refs.summary || !refs.content) return;

    refs.root.dataset.searchState = searchModalState.view;
    refs.content.setAttribute("aria-busy", String(searchModalState.view === "loading"));

    if (searchModalState.summary) {
        refs.summary.hidden = false;
        refs.summary.textContent = searchModalState.summary;
    } else {
        refs.summary.hidden = true;
        refs.summary.textContent = "";
    }

    const list = refs.content.querySelector(".site-search__results-list");
    const moreHadFocus =
        refs.content.querySelector("[data-search-more]") === document.activeElement;
    if (appendFrom !== undefined && list && searchModalState.view === "loading") {
        refs.content.querySelector("[data-search-more]")?.setAttribute("aria-disabled", "true");
        return;
    }
    if (appendFrom !== undefined && list && searchModalState.view === "results") {
        refs.content.querySelector("[data-search-retry]")?.remove();
        list.insertAdjacentHTML(
            "beforeend",
            searchModalState.results.slice(appendFrom).map(renderSearchResult).join(""),
        );
    } else {
        refs.content.innerHTML = getSearchModalContent();
    }
    const batch = searchModalState.batch;
    if (searchModalState.view === "results" && batch) {
        if (batch.entries.some((entry) => entry.status === "rejected")) {
            refs.content.insertAdjacentHTML(
                "beforeend",
                `<button type="button" class="search-action" data-search-retry>${UI.retry}</button>`,
            );
        }
        const more = refs.content.querySelector("[data-search-more]");
        if (batch.matches.length > batch.entries.length) {
            if (more) more.removeAttribute("aria-disabled");
            else {
                refs.content.insertAdjacentHTML(
                    "beforeend",
                    `<button type="button" class="search-action" data-search-more>${UI.more}</button>`,
                );
            }
        } else {
            more?.remove();
        }
    }
    if (moreHadFocus) {
        const next =
            refs.content.querySelector<HTMLElement>("[data-search-more]") ??
            refs.content.querySelectorAll<HTMLElement>("[data-search-result-link]")[
                appendFrom ?? 0
            ] ??
            refs.content.querySelector<HTMLElement>(".search-action");
        next?.focus({ preventScroll: true });
    }
}

function getSearchModalContent(): string {
    const t = UI;
    if (searchModalState.view === "outdated")
        return `
        <div class="site-search__empty-state">
            <p class="site-search__headline">${t.outdated}</p><p class="site-search__subline">${t.outdatedHelp}</p>
            <a class="search-action" href="${escapeAttribute(location.href)}" data-astro-reload>${t.reload}</a>
            <a class="search-action" href="/posts/">${t.archive}</a>
        </div>`;
    if (searchModalState.view === "loading") {
        return `
        <div class="site-search__empty-state">
          <div class="site-search__spinner" aria-hidden="true"></div>
          <p class="site-search__headline">${t.searching}</p>
          <p class="site-search__subline">${t.searchingHelp}</p>
        </div>
      `;
    }

    if (searchModalState.view === "unavailable") {
        return `
        <div class="site-search__empty-state">
          <p class="site-search__headline">${t.unavailable}</p>
          <p class="site-search__subline">${t.unavailableHelp}</p>
          <div><button type="button" class="search-action" data-search-retry>${t.retry}</button> <a class="search-action" href="/posts/">${t.archive}</a> <a class="search-action" href="${escapeAttribute(location.href)}" data-astro-reload>${t.reload}</a></div>
        </div>
      `;
    }

    if (searchModalState.view === "empty") {
        return `
        <div class="site-search__empty-state">
          <p class="site-search__headline">${t.empty}</p>
          <p class="site-search__subline">${t.emptyHelp}</p>
        </div>
      `;
    }

    if (searchModalState.view === "results") {
        return `
        <ul class="site-search__results-list">
          ${searchModalState.results.map(renderSearchResult).join("")}
        </ul>
      `;
    }

    return `
      <div class="site-search__empty-state">
        <p class="site-search__headline">${t.idle}</p>
        <p class="site-search__subline">${t.idleHelp}</p>
      </div>
    `;
}

function renderSearchResult(result: SearchResult): string {
    return `
      <li class="site-search__result">
        <a
          class="site-search__result-link"
          href="${escapeAttribute(result.href)}"
          data-search-result-link="true"
        >
          ${result.date ? `<p class="site-search__result-date">${escapeHtml(result.date)}</p>` : ""}
          <h3 class="site-search__result-title">${escapeHtml(result.title)}</h3>
          <p class="site-search__result-excerpt">${sanitizeExcerpt(result.excerpt)}</p>
        </a>
      </li>
    `;
}

function sanitizeExcerpt(html: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;
    const render = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
        const text = Array.from(node.childNodes).map(render).join("");
        return node instanceof Element && node.tagName === "MARK" ? `<mark>${text}</mark>` : text;
    };
    return Array.from(template.content.childNodes).map(render).join("");
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

bindSearchModal();
initSearchModal();
