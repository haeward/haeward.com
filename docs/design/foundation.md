# Foundation

The site uses a restrained neutral, screen-oriented reading system. The implementation in
`src/styles/global.css` is authoritative; reuse its semantic variables.

## Color roles

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f4f5f5` | `#1e2020` |
| Secondary surface | `#e9ebeb` | `#282b2b` |
| Heading | `#171a1f` | `#f1f3f5` |
| Body | `#262a30` | `#d5d9e0` |
| Secondary text | `#616973` | `#aab1b1` |
| Prose link | inherits surrounding text | inherits surrounding text |
| Prose link hover | `#111318` | `#ffffff` |
| Borders | neutral translucent black | neutral translucent white |

Prose links use a 1px underline and weight 500; blue remains an interaction/focus
accent for controls. Tables, quotes, inline
code, and ordinary containers use neutral colors. Media retains its existing
cover artwork and amber rating stars; its component behavior is documented in
[Components](components.md#media-browser-and-cards).

## Background

All shared-shell pages use `#1e2020` charcoal in
dark mode and a corresponding neutral pale gray (`#f4f5f5`) in light mode.
Secondary surfaces and metadata remain neutral, with readable contrast against
the canvas and inherited-color links.
The existing monochrome home social images are brightened and desaturated in
dark mode so their silhouettes remain visible against the charcoal canvas.

Header uses the identical, fully opaque `--site-canvas` value, without blur or
transparency or a bottom divider. It remains in normal document flow, so it scrolls
away with the page and does not cover the reading viewport. There is no diamond grid, reactor icon, mask layer, or decorative
background asset. Print remains white. The independent RSS preview retains its
yellow palette and Poké Ball pattern.

`PageLayout.astro` renders one pair of fixed canvas-colored edge fades on every
shared-shell page. Both fades start at the viewport edges and are 5.5rem high;
they ignore pointer events. The normal-flow header and floating controls stay
above them, native dialogs use the top layer, and print hides both fades. The
independent RSS preview does not use this treatment.

The top fade is transparent at the document start and gains opacity over the
first fade-height of scrolling. The bottom fade weakens over the final fade-height
and disappears at the document end. Pages that fit within the viewport have no
edge fades. The shared site script updates both on scroll, resize, content-height
changes, and client navigation; without JavaScript both stay transparent so
headings and footer links remain readable. This scroll-linked opacity has no
timed animation; elastic overscroll is clamped to the document's scroll range.

## Typography

UI and prose use system sans-serif fonts. Code uses system monospace fonts.
The shared site shell downloads no reading fonts. The standalone RSS preview
retains its original fonts as an intentional visual exception.
Historical `serif-reading-*` classes are
compatibility hooks and do not select a serif font.

Prose is 17px / 1.9 on mobile and 18px / 1.95 from 640px. Paragraph gaps are
20px and 24px. Page titles use 28px and 32px at weight 600; section headings
use 22px and 24px at weight 600. Post-list titles share the body size with a
1.65 line height; dates use 13px. Metadata uses the existing muted color,
introductory text uses body-soft, and headings use the heading color.
Strong text is bold without extra inline padding. Work quotations opt into
local Kai/serif fonts, with no font downloads.

## Geometry

The shared shell is at most 768px including its gutters; the article column is
at most 720px. Mobile gutters are 20px. Wide tables and code scroll inside their
own containers, never by widening the page. Lists vertically center dates against
naturally wrapping title blocks. Header controls have at least a 44px target.
The normal-flow header has 12px vertical padding on mobile and 16px from 640px.
Main adds 16px / 20px above its content, so the visible header-row-to-content gap
is 28px / 36px. Shared page sections have 40px / 48px gaps. Post lists keep
their 8px / 16px inset, and paragraphs have no first-line indent.

## Motion and focus

Content is visible in the initial HTML/CSS. There are no staggered entrance
animations or decorative article-image hover transforms. Short state feedback
is retained. Reduced-motion preferences disable nonessential animation,
transitions, and smooth scrolling. Focus rings remain visible to keyboard users.

Client navigation focuses the destination hash or main region without forcing
another scroll. History traversal retains the router's scroll restoration.
Targets retain a modest scroll margin for comfortable placement after navigation.
Navigation labels stay
English; actions and feedback use the shared English strings in `src/lib/ui.ts`.
Content language is independent: Chinese posts retain `lang="zh-CN"`, with English
UI regions marked separately. Article titles and body content are not translated.
Homepage social links expose a new-window hint in their HTML;
Blogroll links open in a new tab with `noopener noreferrer`;
the global link enhancer covers other explicit new-window links with JavaScript.

## Maintenance

Add dark equivalents for new semantic roles. Avoid component-specific palettes,
ornamental panels around prose, or increasing the font/download budget without
measurement. RSS has independent CSS and intentionally retains its original
yellow palette, outlined panels, and decorative background; see [RSS](rss.md).
