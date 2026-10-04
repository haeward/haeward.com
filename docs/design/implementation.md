# Design implementation and follow-up

This record consolidates the September reading migration, its initial audit and
follow-up, and the subsequent Blogroll, article-image, media, and search changes.
It describes repository implementation and historical acceptance. A completed
code change does not establish deployment success or manual device acceptance.
Current visual values belong in [Foundation](foundation.md), [Reading](reading.md),
[Components](components.md), [Blogroll](blogroll.md), and [RSS](rss.md).

## Implemented scope

| Surface | Result | Primary implementation |
| --- | --- | --- |
| Shared shell | Neutral palette, system fonts, initial content visibility, skip link, normal-flow header, active navigation, two-mode theme, edge fades, reduced motion | `src/styles/global.css`, `src/layouts/PageLayout.astro`, `src/components/Header.astro`, `src/scripts/site.ts` |
| Home and Archive | Compact illustration and social targets, responsive post rows, All posts link, year headings and counts | `src/pages/index.astro`, `src/pages/posts/index.astro`, `src/components/ArrowCard.astro` |
| Articles | 720px column, rendered-text statistics, native mobile TOC, stable heading IDs, table scrolling, code copy/wrap, work quotations, print | `src/pages/posts/[...slug].astro`, `src/lib/rehype-reading.ts`, `src/lib/remark-work-quote.ts`, `src/scripts/blog-toc.ts` |
| Figures and replies | Measured responsive images, fitted placeholders, preview-first modal with retry, explicit original links, Email and optional Mastodon discussion | `src/lib/remark-image-caption.ts`, `scripts/content/image-metadata.mjs`, `src/scripts/article-lightbox.ts`, `src/components/PostReplies.astro` |
| Search | Lazy Pagefind, IME handling, bounded waits, partial failure/retry, incremental results, index-version checks, navigation-safe state | `src/components/SearchModal.astro`, `src/scripts/search-modal.ts`, `src/scripts/dialog-focus.ts`, `src/scripts/timeout.ts` |
| Blogroll | Single OPML source/download, validated URLs, daily deterministic order, local responsive icons and favicon fallbacks | `src/pages/links.astro`, `src/components/BlogrollCard.astro`, `src/lib/blogroll.ts`, `src/lib/blogroll-order.ts` |
| Media | Keyboard tabs, preserved router history, incremental cards, per-page request/observer cleanup, timeout/retry, optimized covers | `src/lib/media.ts`, `src/scripts/media-tabs.ts`, `src/components/MediaBrowser.astro` and related components |
| About, Changelog, 404 | Correct language/date semantics, retained biography/history, canonical and OG fallback handling, recovery actions and 404 noindex | Corresponding routes, `src/components/Head.astro`, `src/lib/og.ts` |
| RSS | Full post HTML, absolute content URLs, independent yellow XSL preview, honest clipboard feedback, dedicated feed icon | `src/pages/rss.xml.ts`, `src/lib/rss-content.ts`, `public/feed/pretty-feed.xsl` |
| Delivery and validation | Node declaration, pinned deployment CLI, mutable-resource revalidation, fingerprinted asset caching, content/data checks, two-engine CI | `.node-version`, `public/_headers`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/verify/` |

Now, Moments, and Toolbox routes and their drafts were removed. Their former
recording and publishing proposals are cancelled. The article body languages,
existing post slugs, full RSS semantics, and media pagination shape remain the
contracts to preserve in future work.

## Decisions that supersede earlier records

- The first reading package described a three-state theme and a fixed header.
  The current UI toggles light/dark and uses a normal-flow opaque header.
- Visible heading links and chapter-copy controls were removed after the initial
  proposal; stable IDs and ordinary TOC links remain.
- Interface feedback is English across content languages. Earlier bilingual
  feedback proposals no longer describe the implementation.
- The old categorized Links page, connectivity monitoring, JSON manifests, icon
  sync scripts, and Links workflow were replaced by the OPML Blogroll. The
  intermediate transactional Links-sync implementation is retired.
- Media was deferred in the original reading package. Later work implemented
  pagination, focus/history recovery, request isolation, keyboard tabs, and cover
  optimization. Full media search and editorial redesign remain separate work.
- A damaged Xiaoxitian CDN derivative was diagnosed by visual inspection despite
  a successful decode. A temporary local repair was used during investigation;
  current article sources use `webp.haeward.com`, with no local photo copies.
  Decoding and dimensions cannot establish visual integrity on their own.
- Search state and its binding guard survived structural simplification: removing
  them broke query retention across deployed script versions. Native header
  anchors and shared helpers replaced unused wrappers instead.

## Verification scope

The original reading/follow-up records report successful lint, Markdown, secrets,
Astro/Pagefind builds, data/content checks, and Chromium/WebKit smoke. Later
interaction and image records extend that evidence; see the
[performance record](../performance/README.md) for dates, baselines, and samples.
Re-run the checks in [AGENTS.md](../../AGENTS.md) for any new change; historical
passes do not replace current validation.

Browser regression coverage includes no-JS reading, keyboard and focus handling,
320/390/640/768/1440px and landscape layouts, 200% root-font reflow, blocked storage,
clipboard success/failure, malformed hashes, history scroll restoration,
search timeout/partial results/index changes, media cancellation/retry, and
figure fitting/loading failures. Fixtures are temporary and are not published.
macOS WebKit keyboard tests use Option-Tab where required by its default link
navigation setting. Automated font reflow is not actual browser zoom.

A historical Wrangler 4.135.0 local Pages check verified eight cache rules:
HTML, RSS, sitemap, Pagefind, and fixed media JSON revalidate; `/_astro/`
fingerprinted assets use one-year immutable caching. These rules deliberately
avoid a broad overlapping `/*` pattern. Local results do not verify live CDN
headers or redirects. The current rules are in `public/_headers`.

## Remaining work

| Area | Follow-up and boundary |
| --- | --- |
| Real devices and accessibility | Test iOS/Android software keyboards, real Safari/Chrome 200%/400% zoom, and assistive technologies such as VoiceOver |
| Published site | Check live cache headers, redirects/canonical URLs, cache hits, and independent RSS readers after deployment |
| Field performance | Collect representative LCP/CLS/INP only after deciding the measurement and privacy scope; lab/resource counts do not provide field results |
| Metadata | Optional true revision dates, `updated`, modified-time metadata, JSON-LD, and reliable sitemap `lastmod`; never manufacture dates from build time |
| Architecture | Measure Spotify click-to-load and ClientRouter tradeoffs before changing behavior |
| Security and observation | Evaluate existing platform headers, resource sources, CSP Report-Only, and minimal error/performance observation as a separate decision |
| Media and Douban | Full media discovery/no-JS pagination, cross-deployment pagination consistency, sync concurrency/push safety, and editorial changes need separate scope |
| Content and scale | Identity copy, representative posts, related reading, recommendations, Changelog wording, year navigation, and broader search remain optional editorial work |

Do not restore removed routes or revive retired Links automation as part of these
follow-ups. Avoid treating an old audit identifier or unchecked proposal as a
current defect without first inspecting the implementation.
