# Reading

Primary implementation: `src/pages/posts/[...slug].astro`, reading components,
`src/styles/global.css`, and the article scripts in `src/scripts`.

## Shell and text

Articles use a centered 720px column with 20px mobile gutters. See
[Foundation](foundation.md) for shared typography, focus, and edge fades. The article title
is an `h1`; Markdown supplies the following heading levels. Body text uses
system sans-serif fonts, regular weight, and relaxed line spacing. Reading
statistics are estimates derived from rendered text, excluding HTML attributes
and link destinations. Dates and count/time labels use English on all articles;
both Chinese and English articles use `About … words`. The existing estimate
counts CJK characters and runs of Latin letters or digits; the label is unified,
without changing that approximation.

Article pages use the shared 16px top padding on mobile and 20px from `sm`, with no extra
outer margin on the article header. The title and metadata are separated by
12px; wrapped metadata rows use an 8px gap. The body follows a visible mobile
TOC by 24px, or the header by 32px when the TOC is absent or in the desktop rail.
The first body element has no top margin, so it cannot add another offset.

Prose h2 spacing is 40px before and 16px after on mobile, increasing to 48/16px
from `sm`. H3 uses 32/12px and 36/12px respectively. Body copy is 17px / 1.9
on mobile and 18px / 1.95 from `sm`, with 20px / 24px paragraph gaps.
H2 is 22px / 24px; H3 is 19px / 20px; both have a 1.5 line height and weight 600.
Images have 32px vertical margins and captions follow by 12px. Captions are
14px / 1.7, regular weight and muted. Compact list items use
2px vertical margins; About's first descriptive list separates successive outer
items by 8px, without expanding its short link list or nested lists.

## Links, quotes, and code

Prose links inherit the surrounding text color, use weight 500 and a persistent
1px underline. Hover/focus uses the neutral-hover text color without changing
weight or layout. Ordinary links use normal browser
navigation, including same-origin absolute URLs. Explicit new-tab links retain
safe `rel` values and a concise new-tab hint. Link text remains the accessible
name; scripts do not replace every name with a verbose URL description.
Markdown external HTTP(S) text links receive a small neutral northeast arrow
at build time; no site icons are prepended. The arrows are decorative and hidden from assistive
technology and search indexing. Relative links, same-site links, email links,
image links, and existing icon cards do not receive duplicate decoration.

Quotes use a neutral left border, normal weight, and no colored panel or shadow.
Strong text has no badge-like padding. Inline code uses a neutral surface and
system monospace. Code blocks scroll locally; JavaScript adds a real Copy code
button and a live success/failure message. A separate pressed-state button toggles
wrapping; horizontal scrolling remains the default. Without JS the code remains readable.

### Work quotations

`remark-work-quote.ts` recognizes a standalone `[!QUOTE]` paragraph at the start
of a Markdown blockquote. This works for any quoted work, not only poetry:

```markdown
> [!QUOTE]
>
> 白日依山尽，黄河入海流。\
> 欲穷千里目，更上一层楼。
>
> — 王之涣《登鹳雀楼》
```

Leave a blank quoted line after the marker. A final paragraph starting with
an em dash (`—`) followed by a space becomes an optional right-aligned attribution; Markdown links and emphasis
are supported there. A trailing backslash makes an intentional line break;
ordinary wrapped prose flows naturally. Multiple quoted paragraphs are supported.
No decorative quotation marks are added. Author-written punctuation is preserved.
A bare marker without content remains ordinary text.

Use `[!QUOTE center]` instead of `[!QUOTE]` to center only that quotation's text,
for example a poem. The source remains right-aligned. The default marker stays
left-aligned; centering is never inferred from content or applied to other quotes.

Rendering produces `figure.literary-quote > blockquote` plus optional
`figcaption`, so content and attribution survive in RSS and without JavaScript.
These figures explicitly align left, have no border or background, use 18px /
20px local Kai/serif text at 2.1 line height, and 32px / 40px vertical margins.
The quotation is inset 1em. The source follows
by 16px. Unmarked practical notes keep their normal bordered style.

Headings h2–h4 receive stable IDs during Markdown rendering so the article TOC can
jump to sections without client code. Visible heading links and chapter-link copy
controls are not generated; the TOC is the sole section-navigation affordance.
About also omits visible heading links. Articles inherit the shared layout's soft
canvas-colored fades from the viewport edges; the top fade is transparent at the
document start and the header scrolls away with the page. These fades do not
change the reading column or TOC rail.

## Tables

`rehype-reading.ts` generates a focusable, named scrolling wrapper and column
header scopes during Markdown rendering. Author-specified alignment is preserved;
otherwise cells are left-aligned. Numeric/date-only cells avoid breaking apart.
Headers use a neutral surface and rows use thin horizontal separators.

## Table of contents

The article renders both variants of `TableOfContents.astro`. Mobile uses native
`details` before the body; it works without JS. Wide screens use the existing
side rail, visible from the start. The rail uses a restrained grayscale palette,
compact rows, and a small gap between the progress track and the first entry;
its position and progress geometry remain unchanged. Progress and active-section
state are optional script enhancements. Malformed hashes are ignored safely. Observers/listeners
are cleaned up before client navigation.

The mobile TOC sits 24px after metadata. Its summary keeps a minimum 44px target
and a native disclosure marker; only the open state adds bottom padding for the
entries. The collapsed box is 46px high with the current single-line label.

## Images

For source preparation and publication checks, see the
[image budget](../content-image-budget.md) and [image strategy](../image-strategy.md).

`remark-image-caption.ts` keeps captions and responsive sources. The first figure
loads eagerly with high fetch priority; later figures use native lazy loading.
Only articles that reference `webp.haeward.com` preconnect to that image origin.
Images fit both the column and a 72vh / 672px height limit without cropping. The
`sizes` hint accounts for that height limit and the image aspect ratio, avoiding
oversized downloads for fitted portraits. The default source is a measured
variant near the reading-column width, instead of an unconditional 1024px request.
Measured figures reserve that fitted width and aspect ratio before decoding, so
slow requests cannot collapse their image links or move the following caption.

`src/data/article-images.json` records measured CDN dimensions for requests at
480, 768, 1024, and 1440px. The CDN may return a smaller or rounded width, so
`srcset` uses the actual measured widths and deduplicates equal widths. Run
`pnpm run sync:article-images` after adding supported article images. Use
`--refresh` to remeasure changed CDN resources. The scan decodes full responses,
not only headers, and publishes the manifest only after the complete scan succeeds.
Normal builds never fetch remote image dimensions.

Current article images, including the Xiaoxitian photograph, use the site's
`webp.haeward.com` image domain. Their measured responsive variants and original
links stay remote; there are no article photo copies under `public/`.
Local sources under `public/assets/images/posts/` remain supported by the same
sync command if needed later. It preserves the source and generates WebP variants
up to 1440px without upscaling, recording their URLs and dimensions in the manifest.
A successfully decoded image can still contain visually damaged pixels, so
source changes also require visual inspection.

A static image link provides keyboard access and a no-JS original-image fallback.
Image links and Open original opt out of Astro prefetch, so focus or hover cannot
download the unbounded original before an explicit open.
With JS, it opens a native modal dialog and immediately reuses an already-loaded
thumbnail. A detached image loads and decodes a sharper responsive candidate for
the viewer's fitted size and device pixel ratio, then replaces the preview.
It does not automatically download the unbounded original. Open original remains
an explicit action. Images without responsive variants still load their original.

The toolbar, fitted image, caption, and feedback occupy separate rows. Portraits,
landscapes, and long captions remain inside the viewport. Escape, Close, and the
backdrop dismiss the dialog and restore focus. Failed or timed-out requests keep
any available preview and expose Retry and Open original. Closing, reopening, or
client navigation invalidates pending loads to prevent stale images appearing.

## Replies

`PostReplies.astro` appears after the body, aligned to the reading column’s right edge.
The label is `Reply:`; icons sit 6px from names, platforms are 20px apart, and
the label sits 12px from the platform group. Narrow layouts can wrap to the right.
Email and Mastodon use the existing social icons with visible English names.
Email uses the configured public address and a URL-encoded `Re: <article title>`
subject. The optional article frontmatter field `mastodonUrl` accepts an HTTPS
link to that article's discussion. Without a link, Mastodon is a noninteractive,
accessible placeholder; it does not link to a profile or a dummy fragment.
The reply region is excluded from search indexing and print.

## Print

Print CSS hides navigation, dialogs, reading controls, and the footer. It uses
plain readable text and avoids splitting figures, code blocks, and table rows
where possible. This is a basic print layout, not a paginated publishing format.

## Verification

`pnpm run smoke` exercises the current site plus a Markdown table/code fixture.
Checks include no-JS reading, keyboard dialogs, narrow screens, table alignment,
code-copy success/failure, code wrapping, TOC jumps, absence of visible heading
anchors, malformed hashes, and image dimensions. Both Chromium
and WebKit are run in CI. Fixture content never enters the published site.

After editing Markdown plugins, run `pnpm exec astro build --force` and restart
the development server. If the background server retains old article HTML,
stop it, back up and remove the generated `.astro/data-store.json`, then restart.
Verify actual article output as well as renderer fixtures.
