# RSS

This file documents the feed route and its browser preview.

Primary sources:

- `src/pages/rss.xml.ts`
- `public/feed/pretty-feed.xsl`
- `public/feed/pokeball-pattern.svg`
- `src/components/Head.astro`
- `src/components/Footer.astro`

## Role

`/rss.xml` serves two audiences:

- feed readers that consume the XML directly
- people who open the feed URL in a browser and need a clear preview

Those are related but different surfaces. The XML must stay stable. The browser
preview may be expressive as long as it stays self-contained.

## Feed Route

The RSS route is not a normal page shell.

Current rules:

- route: `src/pages/rss.xml.ts`
- generated through `@astrojs/rss`
- source items come only from published blog posts
- items are newest first
- item content renders the full post body to HTML
- item links use the canonical post path
- feed advertises `/feed/pretty-feed.xsl` as its stylesheet
- Atom self link remains present
- relative body links and image/source URLs resolve against the canonical article URL
- feed icon/logo use the dedicated 144px PNG, independently of the 32px browser favicon

Do not casually change:

- feed URL
- item ordering
- item URL shape
- full-content behavior

## Discovery

RSS stays discoverable in two places:

- `Head.astro` adds the alternate feed link
- `Footer.astro` exposes a visible `RSS` text link

RSS is a utility destination, not a header-nav section.

## Browser Preview

The XSL preview intentionally retains its original identity independently of
the site's neutral shell: yellow canvas, cream rounded panels, dark outlines
and offset shadows, red links, and the original LXGW Neo XiHei and JetBrains Mono
fonts. Its light palette remains consistent across system themes. Those font
downloads are restricted to this standalone preview.

The background displays its SVG tile at 104px with approximately 22.5px
Poké Ball motifs centered inside the diamonds. The source viewBox remains 120px
with 26px icons, scaled together by CSS. Muted ochre colors and low opacity keep the pattern
secondary to the content. A slightly darker circular outline keeps the smaller
motif recognizable. Grid opacity is 0.12 and icon opacity is 0.15. Only RSS uses
Poké Balls; other pages have solid neutral backgrounds. The SVG contains its own geometry and needs no scripts
or external image references.

The wrapper remains at 44rem maximum width with mobile gutters. It provides a
back link, subscription explanation, visible feed URL, and a `RECENT POSTS` list.
Items use 0.65rem vertical padding, with a 0.12rem title-to-date gap and no default
date paragraph margins. Long feed URLs and dates can wrap on narrow screens.
Keyboard focus remains visible and reduced-motion preferences are respected.
The feed address remains readable without scripts; copying is a progressive
enhancement. The preview does not import the site router or become a second
article archive.

## Copy Interaction

The feed URL copy control is a real button inside the XSL.

Current behavior:

- value stored in `data-copy`
- browser URL can hydrate the final copy value
- `navigator.clipboard.writeText` when available
- temporary-input fallback when needed
- temporary copied state after success
- fallback return value is checked; failure announces manual copying instead of success
- the fallback returns focus to the copy button and updates a live status message
- visible focus outline

Keep this interaction dependency-free and local to the XSL.

## Constraints

- do not import Tailwind into the XSL preview
- do not try to reuse the normal site header or search modal
- do not add client-side routing behavior
- do not turn the preview into a full article archive

## Validation

Use the validation matrix in [AGENTS.md](../../AGENTS.md). Docs-only work requires
`pnpm run md:lint` and `pnpm run secrets:lint`.

RSS implementation work:

- `pnpm run build:site`
- `pnpm run smoke` when feed behavior or preview behavior changes
- verify `/rss.xml` stays reachable and newest-first
- smoke tests exercise the rendered XSL copy success/failure in both browser engines
- `pnpm run test:data` checks relative links, sources, and encoded URL parameters
