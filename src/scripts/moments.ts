import { escapeAttribute, escapeHtml } from "./html";

type MomentsState = {
    bound: boolean;
};

type MomentsWindow = Window & {
    __momentsState?: MomentsState;
};

type MomentFormatters = {
    date: Intl.DateTimeFormat;
    time: Intl.DateTimeFormat;
};

type MastodonAccount = {
    acct?: string;
    avatar?: string;
    avatar_static?: string;
    display_name?: string;
    url?: string;
    username?: string;
};

type MastodonAttachment = {
    description?: string;
    preview_url?: string;
    type?: string;
    url?: string;
};

type MastodonCard = {
    description?: string;
    image?: string;
    image_description?: string;
    provider_name?: string;
    title?: string;
    url?: string;
};

type MastodonEmoji = {
    shortcode?: string;
    static_url?: string;
    url?: string;
};

type MastodonStatus = {
    account?: MastodonAccount;
    card?: MastodonCard;
    content?: string;
    created_at?: string;
    emojis?: MastodonEmoji[];
    in_reply_to_account_id?: string | null;
    in_reply_to_id?: string | null;
    media_attachments?: MastodonAttachment[];
    quote?: {
        quoted_status?: MastodonStatus;
    };
    reblog?: MastodonStatus;
    url?: string;
};

const MASTODON_MAX_STATUS_LIMIT = 40;

const globalWindow = window as MomentsWindow;
globalWindow.__momentsState ??= { bound: false };

const momentsState = globalWindow.__momentsState;

function initMoments(): void {
    const roots = document.querySelectorAll("[data-moments-root='true']");

    roots.forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        if (root.dataset.momentsReady === "true") return;
        root.dataset.momentsReady = "true";
        void loadMoments(root);
    });
}

async function loadMoments(root: HTMLElement): Promise<void> {
    const account = root.dataset.account;
    const accountId = root.dataset.accountId;
    const domain = root.dataset.domain;
    const rawLimit = Number.parseInt(root.dataset.limit || "5", 10);
    const displayLimit = Number.isFinite(rawLimit) ? Math.max(rawLimit, 1) : 5;
    const statusNode = root.querySelector("[data-moments-status='true']");
    const listNode = root.querySelector("[data-moments-list='true']");
    const moreNode = root.querySelector("[data-moments-more='true']");

    if (
        !account ||
        !accountId ||
        !domain ||
        !(statusNode instanceof HTMLElement) ||
        !(listNode instanceof HTMLUListElement)
    ) {
        return;
    }

    const fallbackHref = root.dataset.profileUrl || `https://${domain}/@${account}`;
    if (moreNode instanceof HTMLElement) {
        moreNode.hidden = true;
    }

    try {
        const statusesUrl = new URL(`https://${domain}/api/v1/accounts/${accountId}/statuses`);
        const fetchLimit = Math.min(MASTODON_MAX_STATUS_LIMIT, displayLimit);
        statusesUrl.searchParams.set("limit", String(fetchLimit));

        const statusesResponse = await fetch(statusesUrl.toString(), {
            headers: { Accept: "application/json" },
        });

        if (!statusesResponse.ok) {
            throw new Error("statuses_failed");
        }

        const statuses = (await statusesResponse.json()) as MastodonStatus[];
        if (!Array.isArray(statuses) || statuses.length === 0) {
            setMomentsEmptyState(statusNode, listNode, fallbackHref);
            return;
        }

        const visibleStatuses = statuses.slice(0, displayLimit);
        if (visibleStatuses.length === 0) {
            setMomentsEmptyState(statusNode, listNode, fallbackHref);
            return;
        }

        const formatters = {
            date: new Intl.DateTimeFormat("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
            }),
            time: new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                hour12: true,
                minute: "2-digit",
            }),
        };

        listNode.innerHTML = visibleStatuses
            .map((status) => renderMomentItem(status, formatters, domain))
            .join("");

        statusNode.hidden = true;
        listNode.hidden = false;
        if (moreNode instanceof HTMLElement) {
            moreNode.hidden = false;
        }
    } catch {
        statusNode.hidden = false;
        statusNode.innerHTML = `Moments are unavailable right now. <a href="${escapeAttribute(
            fallbackHref,
        )}" target="_blank" rel="noreferrer noopener" class="site-link" data-external="true" data-underline="true">Visit Mastodon instead.</a>`;
        listNode.hidden = true;
        listNode.innerHTML = "";
    }
}

function setMomentsEmptyState(
    statusNode: HTMLElement,
    listNode: HTMLUListElement,
    fallbackHref: string,
): void {
    statusNode.hidden = false;
    statusNode.innerHTML = `No recent moments yet. <a href="${escapeAttribute(
        fallbackHref,
    )}" target="_blank" rel="noreferrer noopener" class="site-link" data-external="true" data-underline="true">Check Mastodon.</a>`;
    listNode.hidden = true;
    listNode.innerHTML = "";
}

function renderMomentItem(
    status: MastodonStatus,
    formatters: MomentFormatters,
    domain: string,
): string {
    const displayStatus = status?.reblog ?? status;
    const account = displayStatus?.account ?? {};
    const boosterAccount = status?.reblog ? status.account : undefined;
    const content = sanitizeMomentContent(
        displayStatus?.content,
        account,
        domain,
        displayStatus?.emojis,
    );
    const createdAt =
        typeof displayStatus?.created_at === "string"
            ? formatMomentDate(new Date(displayStatus.created_at), formatters)
            : "";
    const url = typeof displayStatus?.url === "string" ? displayStatus.url : "#";

    return `
      <li data-moments-item="true">
        <div role="article" class="serif-reading-surface px-5 py-4 text-base leading-6 text-(--site-color-text-body)">
          ${renderMomentContext(status, displayStatus, domain)}
          ${renderMomentAuthor(account, domain, boosterAccount)}
          ${content ? `<div class="moments-content mt-2 space-y-1.5">${content}</div>` : ""}
          ${renderMedia(displayStatus?.media_attachments)}
          ${renderPreviewCard(displayStatus?.card)}
          ${renderQuote(displayStatus?.quote, formatters, domain)}

          <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-3 text-[0.93rem] leading-tight text-(--site-color-text-muted) dark:text-[#8b8f98]">
            ${createdAt ? `<time datetime="${escapeAttribute(displayStatus.created_at)}">${escapeHtml(createdAt)}</time>` : ""}
            <span aria-hidden="true">·</span>
            <a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer noopener" class="site-link font-medium" data-external="true" data-underline="true">View Toot</a>
          </div>
        </div>
      </li>
    `;
}

function renderMomentContext(
    status: MastodonStatus,
    displayStatus: MastodonStatus,
    domain: string,
): string {
    if (status?.reblog) {
        const boosterName = formatActionAccountName(status.account);

        return `
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold leading-5 text-(--site-color-text-muted)" data-moments-boost="true">
            <svg class="size-[1.15rem] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 5H15.5C17.43 5 19 6.57 19 8.5V10" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M15 2L19 5L15 8" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M18 19H8.5C6.57 19 5 17.43 5 15.5V14" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M9 22L5 19L9 16" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>${escapeHtml(boosterName)} boosted</span>
          </div>
        `;
    }

    if (typeof displayStatus.in_reply_to_id !== "string" || !displayStatus.in_reply_to_id) {
        return "";
    }

    const replyUrl = `https://${domain}/web/statuses/${encodeURIComponent(
        displayStatus.in_reply_to_id,
    )}`;
    const replyAuthorName = formatActionAccountName(displayStatus.account);

    return `
      <div class="mb-3 flex items-center gap-2 text-sm font-semibold leading-5 text-(--site-color-text-muted)" data-moments-reply="true">
        <span class="text-lg leading-none" aria-hidden="true">↩</span>
        <span>${escapeHtml(replyAuthorName)} replied to <a href="${escapeAttribute(replyUrl)}" target="_blank" rel="noreferrer noopener" class="site-link font-medium" data-external="true" data-underline="true">toot</a></span>
      </div>
    `;
}

function renderMomentAuthor(
    account: MastodonAccount,
    domain: string,
    secondaryAccount?: MastodonAccount,
): string {
    const authorName =
        toPlainText(account.display_name) || account.username || account.acct || "Mastodon";
    const authorHandle = formatAccountHandle(account, domain);
    const accountUrl =
        typeof account.url === "string" && account.url
            ? account.url
            : `https://${domain}/@${account.username || account.acct || ""}`;
    const avatar = account.avatar_static || account.avatar || "";
    const secondaryAvatar = secondaryAccount?.avatar_static || secondaryAccount?.avatar || "";

    return `
      <div class="flex items-start gap-2.5" data-moments-author="true">
        ${
            avatar
                ? `<div class="relative size-11 shrink-0">
                    <img src="${escapeAttribute(avatar)}" alt="" class="size-9 rounded-md object-cover" loading="lazy" data-moments-author-avatar="true">
                    ${
                        secondaryAvatar
                            ? `<img src="${escapeAttribute(secondaryAvatar)}" alt="" class="absolute right-0 bottom-0 size-5 rounded-full border-2 border-[#efeee9] object-cover dark:border-stone-900" loading="lazy" data-moments-boost-avatar="true">`
                            : ""
                    }
                  </div>`
                : ""
        }
        <div class="min-w-0 flex-1 pt-0.5">
          <a href="${escapeAttribute(accountUrl)}" target="_blank" rel="noreferrer noopener" class="site-link block truncate text-sm font-semibold leading-5 text-(--site-color-text-primary)" data-external="true">${escapeHtml(authorName)}</a>
          ${authorHandle ? `<div class="truncate text-xs leading-5 text-(--site-color-text-muted)" data-moments-author-handle="true">${escapeHtml(authorHandle)}</div>` : ""}
        </div>
      </div>
    `;
}

function formatActionAccountName(account?: MastodonAccount): string {
    if (!account) return "Mastodon";

    return toPlainText(account.display_name) || account.username || account.acct || "Mastodon";
}

function renderMedia(attachments?: MastodonAttachment[]): string {
    if (!Array.isArray(attachments) || attachments.length === 0) return "";

    const media = attachments
        .filter(
            (attachment) =>
                ["gifv", "image", "video"].includes(attachment?.type ?? "") &&
                (attachment.preview_url || attachment.url),
        )
        .slice(0, 4);
    if (media.length === 0) return "";

    return `
      <div class="mt-2 grid gap-2.5 ${media.length === 1 ? "" : "grid-cols-2"}">
        ${media
            .map((attachment) => {
                const src = attachment.preview_url || attachment.url || "";
                const alt = attachment.description || "";
                const baseClass =
                    "h-auto max-h-112 w-full rounded-lg border border-black/20 bg-black/5 object-contain dark:border-white/20 dark:bg-white/5";

                if (attachment.type === "video" || attachment.type === "gifv") {
                    const videoSrc = attachment.url || src;
                    return `<video src="${escapeAttribute(videoSrc)}" poster="${escapeAttribute(src)}" class="${baseClass}" controls playsinline preload="metadata" data-moments-media="true"></video>`;
                }

                return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" class="${baseClass}" loading="lazy" data-moments-media="true">`;
            })
            .join("")}
      </div>
    `;
}

function renderPreviewCard(card?: MastodonCard): string {
    if (!card?.url || (!card.title && !card.description && !card.image)) return "";

    return `
      <a href="${escapeAttribute(card.url)}" target="_blank" rel="noreferrer noopener" class="site-link-surface mt-2 grid overflow-hidden rounded-lg border border-black/20 transition-colors duration-200 dark:border-white/20 sm:grid-cols-[8rem_minmax(0,1fr)]">
        ${
            card.image
                ? `<img src="${escapeAttribute(card.image)}" alt="" class="aspect-video h-full w-full object-cover sm:aspect-auto" loading="lazy">`
                : ""
        }
        <div class="space-y-0.5 p-2">
          ${card.provider_name ? `<div class="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-(--site-color-text-muted)">${escapeHtml(card.provider_name)}</div>` : ""}
          ${card.title ? `<div class="line-clamp-2 text-sm font-semibold leading-5 text-(--site-color-text-primary)">${escapeHtml(card.title)}</div>` : ""}
          ${card.description ? `<div class="line-clamp-2 text-xs leading-5 text-(--site-color-text-muted)">${escapeHtml(card.description)}</div>` : ""}
        </div>
      </a>
    `;
}

function renderQuote(
    quote: MastodonStatus["quote"],
    formatters: MomentFormatters,
    domain: string,
): string {
    const quotedStatus = quote?.quoted_status;
    if (!quotedStatus) return "";

    const account = quotedStatus.account ?? {};
    const authorName =
        toPlainText(account.display_name) || account.username || account.acct || "Mastodon";
    const authorHandle = formatAccountHandle(account, domain);
    const quoteUrl = typeof quotedStatus.url === "string" ? quotedStatus.url : account.url || "#";
    const accountUrl = typeof account.url === "string" && account.url ? account.url : quoteUrl;
    const avatar = account.avatar_static || account.avatar || "";
    const createdAt =
        typeof quotedStatus.created_at === "string"
            ? formatMomentDate(new Date(quotedStatus.created_at), formatters)
            : "";
    const content = sanitizeMomentContent(
        quotedStatus.content,
        account,
        domain,
        quotedStatus.emojis,
    );

    return `
      <div class="mt-2.5 rounded-lg border border-black/20 bg-black/1.5 p-2.5 dark:border-white/20 dark:bg-white/2.5" data-moments-quote="true">
        <div class="flex items-start gap-2.5">
          ${
              avatar
                  ? `<img src="${escapeAttribute(avatar)}" alt="" class="size-8 shrink-0 rounded-md object-cover" loading="lazy" data-moments-quote-avatar="true">`
                  : ""
}
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <a href="${escapeAttribute(accountUrl)}" target="_blank" rel="noreferrer noopener" class="site-link truncate text-sm font-semibold text-(--site-color-text-primary)" data-external="true">${escapeHtml(authorName)}</a>
              ${authorHandle ? `<span class="truncate text-xs text-(--site-color-text-muted)">${escapeHtml(authorHandle)}</span>` : ""}
            </div>
            ${
                createdAt
                    ? `<a href="${escapeAttribute(quoteUrl)}" target="_blank" rel="noreferrer noopener" class="site-link mt-0.5 inline-block text-xs text-(--site-color-text-muted)" data-external="true"><time datetime="${escapeAttribute(quotedStatus.created_at)}">${escapeHtml(createdAt)}</time></a>`
                    : ""
            }
          </div>
        </div>
        ${content ? `<div class="moments-content mt-2 space-y-1 text-sm leading-6 text-(--site-color-text-body-soft)">${content}</div>` : ""}
        ${renderQuotePreviewCard(quotedStatus.card)}
      </div>
    `;
}

function renderQuotePreviewCard(card?: MastodonCard): string {
    if (!card?.url || (!card.title && !card.description && !card.image)) return "";

    return `
      <a href="${escapeAttribute(card.url)}" target="_blank" rel="noreferrer noopener" class="site-link-surface mt-2 block overflow-hidden rounded-md border border-black/20 transition-colors duration-200 dark:border-white/20" data-moments-quote-card="true">
        ${
            card.image
                ? `<img src="${escapeAttribute(card.image)}" alt="${escapeAttribute(card.image_description || "")}" class="aspect-video max-h-60 w-full object-cover" loading="lazy" data-moments-quote-card-image="true">`
                : ""
        }
        <div class="space-y-1 p-2.5">
          ${card.provider_name ? `<div class="text-xs font-medium text-(--site-color-text-muted)">${escapeHtml(card.provider_name)}</div>` : ""}
          ${card.title ? `<div class="line-clamp-2 text-sm font-semibold leading-5 text-(--site-color-text-primary)">${escapeHtml(card.title)}</div>` : ""}
          ${card.description ? `<div class="line-clamp-2 text-xs leading-5 text-(--site-color-text-muted)">${escapeHtml(card.description)}</div>` : ""}
        </div>
      </a>
    `;
}

function formatAccountHandle(account: MastodonAccount, domain: string): string {
    const acct = account.acct || account.username || "";
    if (!acct) return "";

    return `@${acct.includes("@") ? acct : `${acct}@${domain}`}`;
}

function sanitizeMomentContent(
    html: string | undefined,
    account: MastodonAccount,
    domain: string,
    emojis?: MastodonEmoji[],
): string {
    if (typeof html !== "string" || !html.trim()) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const emojiMap = createEmojiMap(emojis);
    const blocks = Array.from(doc.body.children)
        .map((element) =>
            isInlineQuoteElement(element)
                ? ""
                : renderSafeChildren(element, account, domain, emojiMap),
        )
        .filter(Boolean);

    if (blocks.length === 0) {
        const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
        return text ? `<p>${escapeHtml(text)}</p>` : "";
    }

    return blocks.map((block) => `<p>${block}</p>`).join("");
}

function isInlineQuoteElement(element: Element): boolean {
    return element.classList.contains("quote-inline");
}

function renderSafeChildren(
    node: Node,
    account: MastodonAccount,
    domain: string,
    emojiMap: Map<string, MastodonEmoji>,
): string {
    return Array.from(node.childNodes)
        .map((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                return renderTextWithEmoji(child.textContent || "", emojiMap);
            }

            if (!(child instanceof Element)) return "";

            const tagName = child.tagName.toLowerCase();
            if (tagName === "br") return "<br>";

            if (tagName === "img" && isCustomEmojiImage(child)) {
                const src = child.getAttribute("src") || "";
                const alt = child.getAttribute("alt") || "";
                return renderEmojiImage(src, alt);
            }

            if (tagName === "a") {
                const momentTagName = getMomentTagName(child);
                if (momentTagName) {
                    const href = getMomentTagHref(account, domain, momentTagName);
                    const text = getMomentLinkText(child) || `#${momentTagName}`;
                    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer noopener" class="moments-tag-link" data-external="true" data-moments-tag="true">${renderTextWithEmoji(text, emojiMap)}</a>`;
                }

                const href = getMomentLinkHref(child, account, domain);
                const text = getMomentLinkText(child) || href;
                return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer noopener" class="site-link font-medium" data-external="true" data-underline="true">${renderTextWithEmoji(text, emojiMap)}</a>`;
            }

            return renderSafeChildren(child, account, domain, emojiMap);
        })
        .join("");
}

function getMomentLinkText(link: Element): string {
    const rendered = Array.from(link.childNodes)
        .map((child) => getVisibleLinkText(child))
        .join("")
        .replace(/\s+/g, " ")
        .trim();

    return rendered || (link.textContent || "").replace(/\s+/g, " ").trim();
}

function getVisibleLinkText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof Element)) return "";

    if (node.classList.contains("invisible")) return "";

    const text = Array.from(node.childNodes)
        .map((child) => getVisibleLinkText(child))
        .join("");
    return node.classList.contains("ellipsis") ? `${text}...` : text;
}

function getMomentTagName(link: Element): string {
    const href = link.getAttribute("href") || "";
    const tagNameFromHref = getTagNameFromHref(href);
    if (tagNameFromHref) return tagNameFromHref;

    const text = getMomentLinkText(link) || (link.textContent || "").replace(/\s+/g, " ").trim();
    if (!text.startsWith("#")) return "";

    return text.slice(1).split(/\s+/)[0] || "";
}

function createEmojiMap(emojis?: MastodonEmoji[]): Map<string, MastodonEmoji> {
    const emojiMap = new Map<string, MastodonEmoji>();
    if (!Array.isArray(emojis)) return emojiMap;

    emojis.forEach((emoji) => {
        const shortcode = emoji?.shortcode;
        const src = emoji?.url || emoji?.static_url;
        if (typeof shortcode !== "string" || !shortcode || typeof src !== "string" || !src) {
            return;
        }
        emojiMap.set(shortcode, emoji);
    });

    return emojiMap;
}

function renderTextWithEmoji(text: string, emojiMap: Map<string, MastodonEmoji>): string {
    if (emojiMap.size === 0 || !text.includes(":")) return escapeHtml(text);

    const shortcodePattern = /:([A-Za-z0-9_+-]+):/g;
    let rendered = "";
    let lastIndex = 0;

    for (const match of text.matchAll(shortcodePattern)) {
        const matchIndex = match.index ?? 0;
        const [token, shortcode] = match;
        const emoji = emojiMap.get(shortcode);

        rendered += escapeHtml(text.slice(lastIndex, matchIndex));
        rendered += emoji
            ? renderEmojiImage(emoji.url || emoji.static_url || "", token)
            : escapeHtml(token);
        lastIndex = matchIndex + token.length;
    }

    rendered += escapeHtml(text.slice(lastIndex));
    return rendered;
}

function renderEmojiImage(src: string, alt: string): string {
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" class="mx-0.5 inline-block size-[1.2em] align-[-0.18em]" loading="lazy" data-moments-emoji="true">`;
}

function isCustomEmojiImage(element: Element): boolean {
    const src = element.getAttribute("src");
    if (!src) return false;

    const classList = Array.from(element.classList);
    return classList.some((className) => ["custom-emoji", "emojione"].includes(className));
}

function getMomentLinkHref(link: Element, account: MastodonAccount, domain: string): string {
    const href = link.getAttribute("href") || "#";
    const text = (link.textContent || "").trim();
    const tagName = getTagNameFromHref(href) || (text.startsWith("#") ? text.slice(1) : "");

    if (!tagName) return href;

    const accountUrl =
        typeof account?.url === "string" && account.url
            ? account.url
            : `https://${domain}/@${account?.username || account?.acct || ""}`;

    return `${accountUrl.replace(/\/$/, "")}/tagged/${encodeURIComponent(tagName)}`;
}

function getMomentTagHref(account: MastodonAccount, domain: string, tagName: string): string {
    const accountUrl =
        typeof account?.url === "string" && account.url
            ? account.url
            : `https://${domain}/@${account?.username || account?.acct || ""}`;

    return `${accountUrl.replace(/\/$/, "")}/tagged/${encodeURIComponent(tagName)}`;
}

function getTagNameFromHref(href: string): string {
    try {
        const url = new URL(href, window.location.href);
        const pathParts = url.pathname.split("/");
        const tagIndex = pathParts.indexOf("tags");
        return tagIndex >= 0 ? decodeURIComponent(pathParts[tagIndex + 1] || "") : "";
    } catch {
        return "";
    }
}

function formatMomentDate(date: Date, formatters: MomentFormatters): string {
    if (Number.isNaN(date.valueOf())) return "";

    return `${formatters.time.format(date)} · ${formatters.date.format(date)}`;
}

function toPlainText(html: string | undefined): string {
    if (typeof html !== "string" || !html.trim()) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const text = doc.body.textContent || "";
    return text.replace(/\s+/g, " ").trim();
}

function bindMoments(): void {
    if (momentsState.bound) return;
    momentsState.bound = true;
    document.addEventListener("DOMContentLoaded", initMoments);
    document.addEventListener("astro:page-load", initMoments);
}

bindMoments();
initMoments();
