# Performance and optimization record

This record combines the reading baseline, structural simplification, interaction
improvements, and image optimization. Each section describes its own historical
build snapshot. Measurements from different rounds are not interchangeable and
are not current deployed-site measurements. Dates are retained here and in JSON;
filenames remain stable for references.

## Evidence and baselines

| Round | Baseline and scope | Tracked evidence |
| --- | --- | --- |
| Reading, 2026-09-19 | Main `9bae5097bb3d481e4c3b1c0bb13a9ebeae0e482f` versus the A/B/C working tree; includes earlier font/favicon changes | [Before](reading-before.json), [after](reading-after.json) |
| Simplification, 2026-10-03 | Complete pre-round working tree, including uncommitted reading/Blogroll changes | [Stages and visual comparison](ablation.json) |
| Interactions, 2026-10-03 | Existing working tree before image, search, media, theme, and prefetch improvements | [Operation counts and comparisons](interactions.json) |
| Images, 2026-10-04 | Existing working tree before icon/cover encoding and article-placeholder fixes | [File sizes and browser samples](images.json) |

The reading snapshot predates removal of chapter-copy controls and Links category
navigation. It measures the retired Links page, not the OPML Blogroll. The later
image baseline includes previous changes. Retained originals increase deployment
size even when generated variants reduce visitor transfers.

## Reading baseline

Conditions: macOS, headless Chromium 153.0.8010.12, 390×844 CSS px, DPR 1, cold
contexts, 200,000 B/s down, 93,750 B/s up, 150ms latency, and 4× CPU slowdown.
Each page ran sequentially three times. Local text/fonts used gzip; external
images used their real CDN. Observation ended after load, font readiness (up to
60 seconds), and two additional seconds, without clicking or scrolling.

Values below are medians; KiB means 1024 bytes. Transfer bytes include only
completed requests. Standalone JS is compressed script response body, excluding
inline scripts embedded in HTML. Script time is CDP ScriptDuration.

| Page | LCP seconds, before → after | CLS, before → after | Completed transfer KiB, before → after | Standalone JS KiB, before → after | Script ms, before → after |
| --- | --- | --- | --- | --- | --- |
| Home | 24.432 → 0.640 | 0 → 0.0011 | 4645.8 → 59.3 | 8.52 → 13.08 | 12 → 12 |
| Southern Shanxi | 24.496 → 0.628 | 0 → 0.0011 | 4679.3 → 83.1 | 8.52 → 13.86 | 15 → 19 |
| Retired Links | 0.696 → 0.596 | 0 → 0.0011 | 4983.9 → 248.7 | 8.52 → 13.08 | 13 → 19 |

The shared shell stopped downloading its large reading font. The old Links LCP
was already early; font savings did not imply identical speed gains on every page.
Links transfer varied from 248.7–408.1 KiB with lazy-icon timing. The observation
window excludes pending requests, images below the fold, and search indexes.
New accessibility, recovery, and version checks increased standalone JS; old
inline logic means that difference is not the full cost of added behavior.

At that snapshot, 25 article images were measured at four requested widths,
producing 93 distinct measured candidates from 100 requests. The CDN sometimes
returned smaller or rounded widths. `srcset` descriptors therefore use measured
widths and deduplicate equal outputs. The compact browser favicon was 3,063 B;
the independent 144px feed icon was 45,253 B versus the 296,452 B original.
The article viewer's then-current original-image behavior was subsequently
replaced by responsive loading; see [Reading](../design/reading.md#images).

## Structural simplification

Accepted changes removed the Link wrapper, unused helpers/exports/UI keys,
`clsx`, and `tailwind-merge`; shared media types/star markup and static-server
utilities replaced duplication. No route or media JSON shape changed.

| Stage | Source lines | Verification lines | Direct dependencies | JS bytes | JS gzip bytes | CSS bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 6285 | 1887 | 16 | 47054 | 17759 | 93026 |
| Accepted A | 6207 | 1887 | 14 | 47012 | 17734 | 93026 |
| Accepted A/B | 6147 | 1887 | 14 | 46944 | 17692 | 93026 |
| Final combination | 6139 | 1835 | 14 | 46747 | 17644 | 93026 |

Source counts include TS/Astro/CSS under `src`; verification counts include MJS
under `scripts/verify`. Content, docs, and generated data are excluded. JS totals
include all `dist/_astro` scripts, compressed with Node 24.14.0; they are not a
single page's download. The 198-line reduction mainly removed maintenance points.

Removing shared search state and its binding guard was rejected: navigation to a
new script URL cleared an existing `Obsidian` query while old document listeners
remained. Cross-script-version navigation regression now protects that behavior.
Dialog focus, timeout/request tokens, media deduplication, caching, and recovery
retained real consumers and stayed in place.

An image-link focus test also found original JPG requests carrying
`Sec-Purpose: prefetch`, initiated by Astro before opening the viewer. Figure
links and Open original now opt out of prefetch. Markdown plugins were force-built
to avoid cached HTML. Sixteen first-viewport comparisons at 390/1280px in both
themes had zero changed pixels with reduced motion and identical external-image
stubs; this does not validate remote-image quality.

## Interaction improvements

| Scenario | Before | After |
| --- | ---: | ---: |
| Home illustration, DPR 1 | 18,342 B | 3,730 B |
| Home illustration, DPR 2 | 18,342 B | 10,726 B |
| Home illustration, DPR 3 | 18,342 B | 17,280 B |
| Search calls to show 24 results | 3 | 1 |
| Search result data calls/normalizations | 48 | 24 |
| Search index-version checks | 7 | 7 |
| Media page 2: new card nodes | 200 | 100 |
| Media page 2: removed old nodes | 100 | 0 |
| Media page 2: preserved cards | 0 | 100 |
| Initial theme logic body-layout reads | 3 | 0 |
| Light-mode navigation layout reads | 2 | 0 |
| Dark-mode navigation layout reads | 2 | 1 |
| Hover/focus requests for three RSS/OPML links | 3 | 0 |

Home used 144/288/384px WebP candidates at quality 80, keeping the 144px square
layout. Visual review retained detail; resampling is not pixel-identical. Search
reuses only the active query's matches and loaded entries, and appends results.
Pagefind already caches fragments, so the reduced data calls do not imply half
as many network downloads. Index checks remain around each operation.

Media now appends cards without replacing focusable existing nodes, preserves
Astro history when changing tabs, isolates requests/observers to the current page,
and bounds fetch plus JSON waits at eight seconds. Keyboard tabs, announced
loading state, search partial-failure retry, invalid-URL skipping, and cancellation
remain covered. RSS and OPML fetch only on activation.

All-client JS gzip increased from 17,644 B to 18,518 B for request isolation and
recovery; CSS stayed at 93,026 B and direct dependencies at 14. Sixteen visual
comparisons preserved layout: Blogroll/article were pixel-identical, home changed
through image resampling, and media differed by at most about 0.068% in rasterization.
Eight media JSON pages and RSS content matched the baseline (excluding build date).

## Image optimization

These byte counts describe image files, excluding HTTP headers.

| Comparison | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| All 24 local Blogroll raster icons, one candidate each at DPR 2 | 1,433,422 B | 29,692 B | 97.93% |
| ameow icon displayed at 32px, DPR 2 | 584,030 B | 1,184 B | 99.80% |
| All 526 media covers | 17,256,330 B | 13,231,932 B | 23.32% |
| First 14 default Movies covers | 426,081 B | 344,556 B | 19.13% |

Icons use 32/64/96px WebP candidates without upscaling; SVG/ICO and remote favicon
fallbacks keep their paths. Daily Blogroll ordering differed across build dates,
so full-page first-viewport totals were not directly compared. Covers use quality
75 WebP, maximum width 540px, without upscaling. At this snapshot all 526 retained
their original dimensions and none grew in bytes. Representative q80/q75/q70 and
AVIF samples were reviewed for small text and line quality; originals stayed intact.

SSR and pagination share cover URLs. Eight JSON pages changed only `cover` values,
preserving fields, counts, order, and page numbers. Covers remain lazy and decode
asynchronously, without forcing visible images to low priority. Preserved originals
plus generated variants grew the full build from 678 files / 37,664,282 B to
1,267 files / 50,995,319 B. These are historical artifact counts, not a live inventory.

Slow-network comparison used Chromium at 390×844, DPR 2, cold cache, 150ms latency,
and 200KiB/s download. Three alternating trials before/after allowed the same
14 movie covers and blocked other image requests.

| Measure | Before | After |
| --- | ---: | ---: |
| Image requests | 14 | 14 |
| CDP transfer bytes including headers | 428,209 B | 346,684 B |
| First four downloads complete, median | 1.699s | 1.531s |
| All 14 downloads complete, median | 2.842s | 2.447s |
| All 14 decodes complete, median | 2.863s | 2.481s |

Article figure links previously shrank before loading despite HTML dimensions.
Measured fitted width/aspect placeholders now keep both figures and captions in
place. An isolated Chromium image-release experiment reduced layout shift from
0.11244 on mobile / 0.08420 on desktop to zero. This is not whole-page or field CLS.
The first figure uses eager/high; later figures stay lazy. Fit remains within the
720px column and 72vh/672px height cap.

An earlier Xiaoxitian derivative had HTTP 200 and decoded successfully while
containing gray pixels. A temporary local replacement and responsive-viewer repair
were reviewed on 2026-09-22; that temporary source is superseded by the current
remote photo. This diagnosis remains relevant: successful decoding cannot detect
all visual corruption. Source and publishing rules are in
[Image strategy](../image-strategy.md) and [Image budget](../content-image-budget.md).

## Verification and reproduction

The recorded rounds report Biome, Markdown/secret checks, Astro/Pagefind builds,
data/content integrity, and Chromium/WebKit smoke. The later rounds checked 74
Astro files without diagnostics. Coverage includes search/version failures,
media pagination/history/retry, resource prefetch, figure success/failure fitting,
responsive viewer retries, focus restoration, and actual cover decoding.
Screenshots remain local ignored output; tracked JSON carries shared measurements.
Current validation requirements are in [AGENTS.md](../../AGENTS.md).

To collect a new lab sample after building:

```sh
pnpm run build
node scripts/verify/performance.mjs --site dist --out /tmp/blog-performance.json --trials 3
```

Remote image measurements require CDN connectivity. For historical comparisons,
export the chosen commit to a separate directory, install with its own lockfile,
and build there. Do not share Astro dependency symlinks or run other builds/browser
suites during timed samples. Record device, browser, network, CPU, cache state,
observation window, and baseline alongside every new result.

Local gzip and simulated network/CPU conditions cannot establish real-device,
real-CDN, or field Core Web Vitals results. No interaction sample supports an INP
claim, and no new visitor measurement service was added. Manual devices, deployed
headers, independent readers, and other acceptance limits are tracked in
[Design implementation](../design/implementation.md#remaining-work).
