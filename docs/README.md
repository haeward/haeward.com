# Documentation

Use [README.md](../README.md) to run the project, [AGENTS.md](../AGENTS.md) for change
and validation rules, and [DESIGN.md](../DESIGN.md) as the visual entry point.

## Current references

| Document | Contents |
| --- | --- |
| [Foundation](design/foundation.md) | Shared visual values, geometry, motion, and focus |
| [Reading](design/reading.md) | Article rendering and authoring conventions |
| [Components](design/components.md) | Reusable UI and page surfaces |
| [Blogroll](design/blogroll.md) | OPML maintenance and card behavior |
| [RSS](design/rss.md) | Feed contract and standalone browser preview |
| [Structured values](design/design.yaml) | Descriptive design values alongside CSS |
| [Article image budget](content-image-budget.md) | Preparation and publishing checks |
| [Image strategy](image-strategy.md) | Resource sources, loading, caching, and migration criteria |
| [OG artwork prompt](og-prompt.md) | Reusable cover-image prompt and identity reference |

## Records and evidence

- [Design implementation](design/implementation.md) combines the reading migration,
  initial audit, follow-up acceptance, and later changes. It distinguishes current
  behavior from postponed work and manual deployment checks.
- [Performance record](performance/README.md) combines the reading baseline,
  structural simplification, interaction optimizations, and image measurements.
  Original JSON samples retain their measurement dates internally.
- [Security review](security-alert-review.md) preserves the dependency review from
  September 2026. It is historical evidence, not a current vulnerability scan.

## Maintenance

Keep one authoritative description for each topic and link to it from other
references. Use descriptive filenames without date suffixes for documents and
tracked evidence; record dates, baselines, and tool versions inside the content.
When combining records, preserve meaningful measurements and unresolved limits,
and remove superseded checklists or broken links to ignored local output.

`output/` is local-only and ignored by Git. Screenshots may be retained there for
local review, but shared documentation should link to tracked evidence. Verify
relative file links after moving or renaming documents. Follow the validation
matrix in AGENTS.md; docs-only changes require Markdown and secret checks.
