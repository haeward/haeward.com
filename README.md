# Personal Blog

[Haeward's blog](https://haeward.com), built with Astro from
[Astro Nano](https://github.com/markhorn-dev/astro-nano). It publishes long-form
articles, an archive, a Douban media library, an OPML Blogroll, and a full-content
RSS feed. Search uses Pagefind; reading and navigation remain available without
JavaScript.

## Local development

Use the Node version in [`.node-version`](.node-version) and the pnpm version in
[`package.json`](package.json). With that Node version active:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

| Command | Purpose |
| --- | --- |
| `pnpm run build:site` | Astro typecheck and static build |
| `pnpm run build` | Production build including Pagefind |
| `pnpm run preview` | Rebuild and preview the production site |
| `pnpm run check` | Biome lint and format check |
| `pnpm run md:lint` | Markdown lint |
| `pnpm run secrets:lint` | Secret scan |
| `pnpm run test:data` | Offline data, URL, and failure regressions |
| `pnpm run check:content` | Source and built-content integrity; run after `build` |
| `pnpm run smoke` | Build and run Chromium browser regressions |

Install Chromium with `pnpm run smoke:install` if needed. For WebKit, run
`pnpm exec playwright install webkit`, then `SMOKE_BROWSER=webkit pnpm run smoke`.
The validation rules for each change type are in [AGENTS.md](AGENTS.md).

## Content and data

- Articles live in `src/content/blog/`; frontmatter is validated by
  `src/content.config.ts`. Standalone About content lives in `src/content/about.md`.
- Markdown supports image captions, responsive figures, work quotations, and
  media embeds. See [Reading](docs/design/reading.md) for authoring syntax and
  [the image budget](docs/content-image-budget.md) before publishing photo-heavy posts.
- After adding or replacing supported article images, run
  `pnpm run sync:article-images`. Use `pnpm run sync:article-images --refresh` to
  remeasure existing CDN images. Normal builds do not fetch image dimensions.
- Douban JSON in `src/data/douban/` and covers in `public/douban/` are sync output.
  Keep data refreshes separate from feature changes; the cover command is
  `pnpm run sync:douban-covers`.

## Blogroll

The page stays at `/links/`. Replace `public/subscriptions.opml` with a curated
blog export, then rebuild. This file supplies both the page and its downloadable
OPML. Website corrections belong in `htmlUrl`; preserve `xmlUrl` for feed readers.
Nested groups are flattened and duplicate website URLs are omitted. Known media
feeds are excluded from the page; the download preserves the original export.

Local icons live in `public/assets/images/blogroll/`, named by hostname without
`www.`. New hosts use remote favicons with an initials fallback. No generated
Links dataset, connectivity checker, icon sync script, or separate workflow is
required. Display order is shuffled deterministically by UTC date at build time;
the daily deployment publishes it after a successful build.

Parser rules, icon treatment, and acceptance checks are documented in
[Blogroll](docs/design/blogroll.md). Run baseline checks, `pnpm run test:data`, and
`pnpm run smoke` after replacing the source.

## Deployment and documentation

The canonical URL is configured in `astro.config.mjs`. GitHub Actions checks the
site and deploys `dist/` to Cloudflare Pages on pushes to `main` and a daily schedule.
Credentials are managed outside the repository. Keep the production search build
and `public/_headers` cache rules with the deployment.

Start with [DESIGN.md](DESIGN.md) for visual work, [AGENTS.md](AGENTS.md) for repository
rules, or [the documentation index](docs/README.md) for implementation records,
performance evidence, image maintenance, and OG artwork instructions.
