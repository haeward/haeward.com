# Design System

This document describes the implemented site. Start here for visual work, then
read the reference for the affected surface. CSS values and behavior come from
`src/styles/global.css`, the Astro components, and `src/scripts/`; update the
references when implementation changes.

## References

| Reference | Responsibility |
| --- | --- |
| [Foundation](docs/design/foundation.md) | Color, typography, shell geometry, motion, focus, and edge fades |
| [Reading](docs/design/reading.md) | Article layout, Markdown syntax, TOC, figures, dialogs, replies, and print |
| [Components](docs/design/components.md) | Navigation, theme, search, post rows, media, and utility controls |
| [Blogroll](docs/design/blogroll.md) | OPML contract, card geometry, icons, daily ordering, and download |
| [RSS](docs/design/rss.md) | Full-content feed and independent XSL browser preview |
| [Structured values](docs/design/design.yaml) | Compact reference values; descriptive, not a generated theme |
| [Implementation and follow-up](docs/design/implementation.md) | Consolidated migration history, verification scope, and remaining work |

## Principles

Content leads. Use stable alignment, restrained hierarchy, neutral surfaces, and
clear hover, focus, and failure states. Reuse semantic CSS variables and existing
components. Keep wide code and tables scrollable within the reading column.

The shared canvas is pale gray in light mode and charcoal in dark mode. System
sans-serif fonts serve UI and prose; code uses system monospace. Prose links
inherit text color and keep a thin underline. Artwork and media ratings retain
their colors. Work quotations can opt into local Kai/serif fallbacks.

The shell is compact, articles are at most 720px wide, and mobile gutters are
20px. The opaque header shares the canvas color and scrolls with the document.
Shared pages use optional canvas-colored viewport-edge fades; these disappear at
the document boundaries and stay transparent without JavaScript.

The independent RSS preview retains its yellow palette, outlined panels, Poké Ball
pattern, and downloaded fonts. Its CSS and interactions stay separate from the
shared shell.

## Behavior and page model

- Home pairs the existing illustration and social links with recent post rows.
- Archive groups posts by year with English counts and dashed dividers.
- Articles retain their original language, semantic headings, figures, and a
  right-aligned reply row. Mobile TOC uses native disclosure; desktop uses a rail.
- Blogroll uses two columns from 640px, one on mobile, and an inline OPML download.
- Media uses accessible tabs, poster grids, incremental pagination, and retry states.
- About retains its Chinese body; Changelog remains a plain dated list.
- 404 offers Home, Archive, and Search recovery. Now, Moments, and Toolbox are removed.

Navigation, dates, controls, reading statistics, and feedback use English. Current
navigation exposes `aria-current`. Interactive targets are at least 44px where
specified. Theme toggles between light and dark, using the OS appearance initially
and remembering the choice when storage is available.

Content and ordinary links work without scripts. Search, code actions, image
viewing, progress, and theme controls are progressive enhancements. Native modal
dialogs expose Close and restore focus; failures expose recoverable feedback.
Client navigation manages focus and preserves history scroll restoration.
Reduced-motion preferences and print reading are supported.

## Validation

Use the change-specific checks in [AGENTS.md](AGENTS.md). UI work needs browser
regressions and practical visual review in both themes and narrow layouts.
[Performance evidence](docs/performance/README.md) records build snapshots and
lab measurements; those numbers do not establish field Core Web Vitals or
completion of the manual follow-up in the implementation record.
