# Blogroll

The Links page is now Blogroll, retaining `/links/` for existing bookmarks.
The source is `public/subscriptions.opml`, maintained from a NetNewsWire
export with corrected website addresses. Replacing it updates both the built list and the downloadable
file. There is no separate generated dataset or network enrichment workflow.

## Presentation

Use a two-column card grid from 640px, with a single column on mobile. Each card
contains a 32px icon, blog name, and website URL; long text wraps. Desktop cards
are at least 72px tall with 10px / 12px padding, 24px row gaps, and 32px column
gaps. The grid has equal 32px side insets and stays centered. Mobile cards use
the same height and padding, with 8px side insets and 18px gaps. Long text can
grow a card naturally. Borders and surfaces are faint. Hover and keyboard focus
subtly strengthen them and underline the name, without a shadow or movement.
Keyboard focus has an explicit outline; reduced motion disables transitions.
Displayed URLs omit the scheme and leading `www.`; link destinations remain intact.

The introduction combines the blog description and the inline, bold OPML download
link. No separate download section appears below the cards. The download opts out
of automatic hover/focus prefetch; activating it still downloads the maintained
file directly. Matching former blog icons live in `public/assets/images/blogroll/`,
named by hostname. Astro produces fingerprinted 32px, 64px, and 96px WebP variants
for local raster icons without upscaling; the browser selects one for the 32px
display and screen density. SVG and ICO files keep their original paths. Remaining sites
use Google's favicon endpoint at display time, with lazy loading, no referrer,
and a first-letter fallback on image failure. Cards open in a new tab with
`noopener noreferrer`. Replacing the OPML still needs no
JSON manifest, connectivity probe, icon sync script, or CI workflow.

Shared Header-to-content spacing is 28px on mobile and 36px from 640px: Header
padding is 12px / 16px, and main top padding is 16px / 20px.

## Parsing

Validate XML syntax with fast-xml-validator before parsing at build time with the
locked fast-xml-parser version. Both are direct dependencies. Decode entities,
preserve names and order, flatten nested
groups, and deduplicate website URLs. Prefer `htmlUrl`; infer a parent path only
from familiar final feed segments when it is absent. Ambiguous URLs and malformed
XML fail the build with actionable errors. Reject unsafe URL schemes and DTDs.

The maintained export should contain blogs. Explicit media groups/types and known
media platform hosts are excluded; generic RSS metadata cannot classify arbitrary
podcasts or video feeds. Downloads preserve the unmodified source export.

## Daily display order

At build time, assign each URL a SHA-256 rank seeded by the current UTC date.
Sort by that rank to produce a deterministic daily shuffle. Rebuilds on the same
UTC date, including builds on machines in different timezones, retain the order;
the next date produces a new order. OPML source/download ordering and feed URLs
are unchanged by this presentation step.

The existing Site Build And Deploy workflow runs daily at 00:05 UTC (08:05 in
Shanghai), so each successful scheduled deployment publishes the day's new order.
Scheduled jobs can be delayed; the deployed static page changes only after a
successful build and deployment. No separate workflow or data commit is needed.
The generated list stores its date for browser checks, avoiding failures if a
build and its tests straddle a UTC date boundary.

## Validation

The former categorized Links page, generated JSON, unused media-link assets,
sync scripts, and Links Assets Sync workflow are retired. BlogrollCard only
presents OPML entries and icons; see [implementation history](implementation.md).

Verify XML variants, missing website fallback, duplicates, malformed inputs,
media exclusion, and changed exports. Run lint, Markdown and secret checks, data
regressions, site/search build, content integrity, and browser smoke checks.
Browser checks cover names/URLs matching the source, exact download bytes,
no-JavaScript rendering, narrow layouts, and theme behavior.
