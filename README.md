# Personal Blog

[Haeward's blog](https://haeward.com), built with Astro and based on
[Astro Nano](https://github.com/markhorn-dev/astro-nano). Search uses Pagefind;
the site is hosted on Cloudflare Pages.

## Run locally

Use Node from [`.node-version`](.node-version) and pnpm from
[`package.json`](package.json), then run:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start the development server |
| `pnpm run build` | Typecheck and build the site, including search |
| `pnpm run preview` | Rebuild and preview the production site |
| `pnpm run check` | Check code formatting and lint |
| `pnpm run smoke` | Build and run browser regressions |

Install the smoke-test browser with `pnpm run smoke:install` before the first run.
See [AGENTS.md](AGENTS.md) for the full command list and validation requirements.

## Content

| Content | Source |
| --- | --- |
| Articles | [`src/content/blog/`](src/content/blog/) |
| About | [`src/content/about.md`](src/content/about.md) |
| Blogroll | [`public/subscriptions.opml`](public/subscriptions.opml) |
| Media | [`src/data/douban/`](src/data/douban/) and [`public/douban/`](public/douban/) |

For article syntax and image preparation, see [Reading](docs/design/reading.md).
After adding supported article images, run `pnpm run sync:article-images`.

To update Blogroll, replace the OPML and rebuild. Add local icons under
`public/assets/images/blogroll/`, named by hostname without `www.`; missing icons
use a globe. See [Blogroll](docs/design/blogroll.md) for details.

## Deployment and references

GitHub Actions checks pull requests and deploys `main` to Cloudflare Pages on
pushes and a daily schedule. CI covers Chromium and WebKit. The canonical site
URL is configured in [`astro.config.mjs`](astro.config.mjs).

Use [DESIGN.md](DESIGN.md) for the current design,
[AGENTS.md](AGENTS.md) for contribution rules and checks, and
[docs/README.md](docs/README.md) to find topic references and the OG artwork prompt.
