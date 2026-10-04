# Components

This file covers the reusable UI pieces and page-level content surfaces that
actually exist in the current repo.

Header links use native anchors. Media cards share data types and star markup
between their initial HTML and client pagination. Search keeps its cross-module
state and binding guard so navigation across deployed script versions preserves
the query without adding duplicate document listeners.

Primary sources:

- `src/components/Header.astro`
- `src/components/SearchModal.astro`
- `src/components/BackToTop.astro`
- `src/components/ArrowCard.astro`
- `src/components/BlogrollCard.astro`
- `src/components/MediaBrowser.astro`
- `src/components/MediaTabs.astro`
- `src/components/MediaPanel.astro`
- `src/components/MediaCard.astro`
- `src/components/Footer.astro`
- `src/styles/global.css`
- `src/scripts/search-modal.ts`
- `src/scripts/media-tabs.ts`
- `src/pages/posts/index.astro`
- `src/pages/links.astro`
- `src/pages/media.astro`

## Selection Guide

| Need | Use |
| --- | --- |
| Global navigation | `Header.astro` |
| Theme control | `#theme-toggle` |
| Global search | `SearchModal.astro` |
| Dense post row | `ArrowCard.astro` |
| Blog subscriptions | `BlogrollCard.astro` with OPML data |
| Poster-first media item | `MediaCard.astro` |
| Media browsing shell | `MediaBrowser.astro` |
| Utility footer links | `Footer.astro` |
| Return-to-top control | `BackToTop.astro` |

## Header

The header is a normal-flow opaque block rendered by `PageLayout.astro`, using the
same canvas color as the page. It scrolls away with the page so reading content is
never covered by persistent navigation.

Current rules:

- global shell uses `px-5`
- inner width stays at `max-w-screen-md`
- mobile stacks into two rows, `sm` becomes a single row
- Brand sits on the left; Navigation, Search, and Theme form the right-hand group
- navigation links and action controls share a 16px gap on desktop, 12px on mobile,
  and 4px below 380px; mobile puts the controls group below Brand
- no divider beneath the header; it shares the page canvas color
- nav stays text-first and stable

Current header nav:

- Archive
- Media
- About
- Blogroll

Do not turn this into a product navbar or drawer-based mobile IA without an
intentional route model change.

## Theme Toggle and Header Actions

The theme toggle is a 48px-wide outlined capsule with a 28px visible track inside
a minimum 44px-high target. Search precedes Theme after the navigation links.

Current behavior:

- modes toggle `light -> dark -> light`, persisted in local storage across visits
- the first visit uses the OS appearance, then remembers it; legacy `system`
  preferences are resolved and saved as light or dark
- button id is `theme-toggle`
- visible icon reflects the resolved page theme: sun on the left in light mode,
  moon on the right in dark mode
- accessible label and tooltip identify the current preference and next action
- focus uses the blue accent ring
- theme changes suppress color-transition flashes; unavailable storage uses memory

`header-action` rules:

- minimum 44px target, approximately 18px icon
- rounded full shape
- muted text at rest
- neutral-hover text on hover
- visible focus ring

All icon-only controls need `aria-label`.

## Search Modal

Search is a command surface, not a page route.

Structural rules:

- root id: `site-search`
- native `dialog`, hidden until opened with `showModal()`
- open state adds `html.search-open`
- panel width: `min(100%, 44rem)`
- panel radius: `0.75rem`
- simple darkened native backdrop; dialog body scrolls inside the viewport

Keyboard behavior from `src/scripts/search-modal.ts`:

- `Meta+K` / `Ctrl+K` opens and closes
- Escape closes
- shortcuts are ignored inside editable targets
- closing restores focus to the previous trigger when appropriate

States:

| State | Meaning |
| --- | --- |
| `idle` | Waiting for input |
| `loading` | Pagefind request in progress |
| `unavailable` | Search index not available |
| `outdated` | Index changed during the page session; reload or browse Archive |
| `empty` | No article matched |
| `results` | Result cards rendered |

Search results are quiet rows with title, date, and highlighted excerpt. Search is lazy-loaded, debounced, and composition-aware. Requests have bounded waits, failed results can be retried, and the archive remains available. Extra results use an explicit Show more control.

Show more reuses the current query's matches and loaded entries, appends new rows,
and preserves keyboard focus. Failed entries have a Retry action; invalid result
URLs are skipped without hiding valid results.

Each search reads the index entry without cache, checks its signature against the
loaded instance, and checks again before publishing results. A changed index
requires an explicit page reload; it does not silently combine deployments.
Pagefind stays unloaded before a search. Actions, errors, counts, and dates use English.

## ArrowCard

`ArrowCard` is the default post-list surface on the home and archive pages.

Post lists are inset from their section headings by 8px on mobile and 16px from
the `sm` breakpoint. The home heading and archive year headings stay aligned with
the page; dates and titles move together inside the list.
Dates are vertically centered against the title block, including multiline titles.

Current composition:

- date-first grid, not title-first card
- compact horizontal rhythm
- no background panel
- hover and keyboard focus underline the title and change text emphasis

Variant behavior:

- `home` uses a longer date column
- `archive` uses a shorter month/day date column
- both use 17px / 18px titles with 1.65 line height and 13px muted dates
- rows have 12px vertical padding; sections use shared 40px / 48px gaps

Use it for post indexes. Do not grow it into an excerpt card by default.

## Blogroll

`BlogrollCard.astro` presents a linked icon/name/URL card. The page stays at
`/links/`; [Blogroll](blogroll.md) owns its geometry, icon processing, OPML parsing,
daily ordering, and download contract. Use that reference when changing this surface.

## Media Browser and Cards

The Media page is built from `MediaBrowser`, `MediaTabs`, `MediaPanel`, and
`MediaCard`.

### Media tabs

- text-first tablist
- 20px horizontal gap and 4px wrap gap, with minimum 44px-high tab targets
- 24px between tabs and the visible panel on mobile, 32px from `sm`
- the browser uses a flex gap so hidden panels leave no extra spacing
- active tab uses stronger text and a bottom border
- hash sync controls active tab
- Left/Right arrows wrap between tabs; Home/End select the first/last tab
- only the active tab participates in sequential keyboard navigation
- changing the hash preserves the client router's history and scroll state
- `role="tablist"`, `role="tab"`, and `role="tabpanel"` are preserved

### Media panels

- default tab is SSR-rendered with items
- other tabs start empty
- each panel owns a grid, status area, retry area, and bottom sentinel
- loading is sentinel-driven, not button-driven
- pagination appends cards without replacing existing cards or their focus
- each media page owns its observer and pending requests; navigation cancels them
- requests time out after eight seconds and expose Retry on failure
- status changes are announced politely and grids expose their loading state

### Media cards

- neutral shell, colorful cover
- `aspect-[2/3]` cover
- two-line title clamp
- amber star rating
- linked cards get focus ring and lift
- static cards preserve the same structure without anchor semantics

Astro generates fingerprinted WebP covers from local originals during the build,
with quality 75 and a maximum width of 540px without upscaling. The current source
dimensions are preserved; SSR and paginated cards use the same cover URL. Covers
load lazily with asynchronous decoding and normal browser priority, rather than
forcing visible covers to low priority. Synced originals remain unchanged.

Keep the shell neutral and let cover art carry the color.

## Article Replies

`PostReplies.astro` renders the article's Email and optional Mastodon discussion
row. Layout, frontmatter, fallback, and print rules are in [Reading](reading.md#replies).

## Footer

The footer is a text utility strip, not a secondary navigation chrome block.

Current utility links:

- Changelog
- RSS

Rules:

- use text links, not icon buttons
- keep the right cluster compact and underlined
- keep RSS in the footer, not the main header
- RSS links and the OPML download load on activation, without hover/focus prefetch

## Back To Top

The back-to-top control is a small floating utility.

Current rules:

- button id: `back-to-top`
- fixed bottom-right
- `size-12`
- `rounded-2xl`
- hidden until `html.scrolled`
- arrow animates directionally on hover

Do not replace it with a loud filled FAB.

## Page-Level Surfaces

The home illustration retains its 144px square layout and original artwork.
Astro supplies 144px, 288px, and original-width WebP candidates; `sizes="144px"`
lets the browser choose an appropriate candidate for its screen density.

### Archive

- visually hidden page h1; year h2 sections begin the visible content
- each year shares a row with its published-post count in English (for example, `2 posts in total`)
- a neutral dashed divider runs below the year/count row; no month grouping
- dense `ArrowCard` list
- no excerpts or cover images
- home offers an All posts link beside Recent posts

### Media

- tabs first
- poster grid second
- empty/retry/loading states stay minimal

### Changelog

- date/content chronology
- border-led grouping
- do not turn it into a card feed

## Quick Reference

| Need | Use |
| --- | --- |
| New list item | start from `ArrowCard` density |
| New utility action | muted text + visible focus + small directional motion |
| New compact card | `rounded-lg`, low-noise border, single clear purpose |
| New content grid | let content define color; keep shell neutral |

## Data Boundaries

Do not hand-edit generated or synced data during design-doc work:

- `src/data/douban/*.json`
- `public/douban/**`

Use the sync commands named in [AGENTS.md](../../AGENTS.md) for data refresh work.

## Do And Don’t

### Do

- Start from existing components before adding a new one.
- Keep surfaces small and readable.
- Preserve semantic attributes and `data-*` hooks.
- Make hover and focus states visible.
- Keep dark mode parity.

### Don’t

- Don’t nest cards.
- Don’t wrap whole page sections in decorative cards.
- Don’t add filters or tabs unless content volume requires them.
- Don’t use hover-only affordances for essential actions.
- Don’t add a new visual language for modals.
