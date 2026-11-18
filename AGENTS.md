# Repository Guidelines

## Project Structure & Module Organization

- `src/pages/` defines Astro routes. `src/pages/posts/**` is the long-form post surface; `src/pages/media/data/**` provides JSON for media pagination.
- `src/content/*.md` stores standalone page content such as `about`. `src/content/blog/**` stores posts validated by `src/content.config.ts`.
- `src/components/` holds reusable UI, `src/layouts/` holds shells, `src/lib/` holds shared data/OG/helpers, and `src/scripts/` holds client-side behavior modules.
- `public/subscriptions.opml` is the Blogroll source and downloadable export. `src/lib/blogroll.ts` parses it at build time.
- `public/assets/images/blogroll/` contains local hostname-named icons; missing or failed icons use a globe placeholder. Cards do not contact remote favicon services, and there is no connectivity checker or icon sync automation.
- `src/data/douban/*.json` and `public/douban/**` are Douban sync output. `src/data/article-images.json` is the measured article-image manifest produced by `sync:article-images`.
- `src/data/og-pages.json`, `src/lib/og.ts`, and `public/assets/images/og/**` back page/post OG assets.
- `public/assets/**` stores static assets. `dist/`, `.astro/`, `node_modules/`, `.pnpm-store/`, and `.wrangler/` are generated or local-only.

## Design Reference

- Read `DESIGN.md` first for visual/styling work. It documents the current site design, not a redesign proposal.
- Use the topic references linked from `DESIGN.md`, including `docs/design/blogroll.md` for OPML/cards. `docs/design/design.yaml` is descriptive; CSS and components remain authoritative.
- If design docs and code disagree, inspect the implementation first and update docs/code together instead of trusting stale prose.

## Documentation Maintenance

- `README.md` owns setup and project orientation; `AGENTS.md` owns working constraints and validation; `DESIGN.md` indexes current visual rules. Use `docs/README.md` to find detailed references.
- Keep current behavior in topic documents; put setup and operation in `README.md` and validation constraints here. Keep investigations, acceptance records, and historical measurements in Git history or PR discussions rather than adding permanent report documents.
- Use descriptive filenames without date suffixes for docs and tracked evidence. Put dates, baseline commits, and tool versions inside the records; update all relative links when moving files.
- Do not present historical checks as new validation, old proposals as current defects, or ignored `output/` captures as shared evidence.

## Setup, Build, and Development Commands

- Install: activate Node from `.node-version`, then `corepack enable && pnpm install --frozen-lockfile`
- Dev server: `pnpm run dev`
- Lint and format check: `pnpm run check`
- Auto-fix Biome issues: `pnpm run check:fix`
- Markdown lint: `pnpm run md:lint`
- Secret lint: `pnpm run secrets:lint`
- Site typecheck/build: `pnpm run build:site`
- Full production build with Pagefind: `pnpm run build`
- Built content integrity: `pnpm run check:content` after the full build
- Preview built site: `pnpm run preview`
- Install local Chromium for smoke tests: `pnpm exec playwright install --with-deps --only-shell chromium`
- Core smoke against an existing production build: `pnpm run smoke`
- Article image dimensions: `pnpm run sync:article-images` after adding supported article images; the normal build does not fetch dimensions.
- Networked sync script: `pnpm run sync:douban-covers`

## Coding Style & Naming Conventions

- Use ESM, TypeScript, Astro components, Tailwind utilities, semicolons, and double quotes.
- Biome is the formatter/linter baseline: 4-space indentation, 100-column width, organized imports.
- Follow existing aliases from `tsconfig.json`: `@components/*`, `@layouts/*`, `@lib/*`, `@consts`, and `@types`.
- Keep components/layouts PascalCase. Keep route and content slugs stable and URL-safe.
- Prefer existing patterns in `src/components/`, `src/lib/`, `src/scripts/`, and `src/styles/global.css` over new abstractions.
- Reuse semantic CSS variables and utility patterns already defined in `src/styles/global.css`; do not introduce a new color system casually.
- Prefer extending the existing `src/scripts/*` client modules over adding large inline scripts.
- Do not add dependencies unless explicitly required. If dependencies change, update `pnpm-lock.yaml`.
- Do not change public routes, content schema, media JSON shape, RSS/sitemap behavior, or deploy/sync workflow behavior unless explicitly requested.

## Testing & Validation

- Baseline validation for code/config changes: `pnpm run check`, `pnpm run md:lint`, `pnpm run secrets:lint`, and `pnpm run build:site`.
- Run `pnpm run check:content` after a full build for content or route changes.
- For UI, route, search, theme, article, media, links, RSS, OG, or client-script changes, run `pnpm run build` and `pnpm run smoke`. Smoke serves `dist/` and samples the main routes, theme, Blogroll, media pagination, lightbox, and real Pagefind search.
- CI and scheduled or manual deployments run `pnpm run check:content` and `pnpm run smoke` after building. They use the hosted runner's preinstalled Chrome.
- Documentation-only changes (README, AGENTS, DESIGN, and docs/) run Markdown and secret lint in the `checks` job.
- Main publishes the same build artifact only after CI checks succeed through the reusable deployment workflow. Scheduled and manual deployments build and run core smoke independently.
- CI builds and tests `dist/` in `checks`. The publish job downloads that artifact. Browser failures retain traces/screenshots for seven days; local `output/` captures remain ignored.
- Blogroll source changes: replace `public/subscriptions.opml`, then run baseline validation, `pnpm run build`, and `pnpm run smoke`.
- Content-only changes: run `pnpm run md:lint`, `pnpm run secrets:lint`, and `pnpm run build:site`. For image-heavy posts, follow the image publication checks in `docs/design/reading.md`.
- Docs-only changes: run `pnpm run md:lint` and `pnpm run secrets:lint`.
- If a network-backed sync fails, do not churn generated files. Report the failure and keep source edits separate.

## Generated Data & Automation

- Do not hand-edit `src/data/douban/*.json` or `public/douban/**` unless the task is a Douban data refresh.
- Do not mix generated data refreshes with feature/code changes unless explicitly requested.
- Preserve `data-*` hooks used by `scripts/verify/smoke.mjs` and the response shape expected by `src/pages/media/data/**`.
- Treat `.github/workflows/ci.yml`, `deploy.yml`, and `douban.yml` as automation-critical. Change them only for CI/deploy/sync work.

## Development Workflow

- Use small, focused changes.
- Branch naming: `feature/...`, `fix/...`, `docs/...`, `refactor/...`, or `test/...`.
- Use Conventional Commit style: `type(scope): concise summary`.
- Valid types include `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, and `build`.
- PR descriptions should state intent, implementation summary, validation run, and skipped checks.
- Include before/after screenshots for visual changes when practical.
- Do not add AI/co-author markers.

## Pre-commit Hooks

- Husky runs `pnpm exec lint-staged` from `.husky/pre-commit`.
- lint-staged runs `biome check --write --no-errors-on-unmatched` for staged JS/TS/Astro/CSS/JSON files.
- lint-staged runs `markdownlint-cli2 --fix` for staged Markdown and MDX files.
- lint-staged runs `secretlint --no-glob` for staged code, data, Markdown, YAML, TOML, env, and text files.
- `src/data/douban/**` is excluded from Biome by `biome.json`.
- Do not bypass hooks unless explicitly requested. If hooks rewrite files, re-check and restage the changes.

## Configuration & Security Notes

- Use Node from `.node-version` and pnpm from `package.json`; keep the lockfile and applicable workflow versions aligned. Douban workflow changes remain a separate workstream.
- Deploy pins Wrangler in `.github/workflows/deploy.yml`. For upgrades, verify the CLI, local Pages headers, and build/smoke checks before changing the pin; retain the deployment command and credentials.
- CI installs with `pnpm install --frozen-lockfile`; do not leave lockfile drift behind.
- Upgrade Astro, MDX, Vite, and Markdown/RSS renderer APIs as a compatible set. Preserve the configured Markdown plugins and HTML whitespace behavior; do not use overrides to hide incompatible peer requirements.
- pnpm enforces a strict 24-hour package release age, matched by Renovate's npm gate. Retry a premature upgrade after the gate expires; do not disable lockfile verification merely to make installation pass.
- The canonical site URL is configured in `astro.config.mjs`; do not duplicate deployment configuration casually.
- Keep secrets out of source files, `public/`, content frontmatter, generated JSON, and design/docs artifacts.
- GitHub Actions deploy/sync secrets are managed outside the repo.
- Do not touch unrelated dirty or untracked files unless the task names them.
