# Design — VitePress documentation site (`apps/docs`)

**Date:** 2026-06-09
**Status:** Approved (brainstorm) — pending implementation plan
**Scope:** Skeleton **and** full content — a buildable, deployed VitePress site with the Neon Grid
theme, a real data-driven chart component, fully authored Guide + Reference content, and CI deploy.

## Goal

Stand up the public documentation site for `distribu-tron` from the pre-built "Neon Grid" design
bundle already landed under `apps/docs/`. This pass delivers a runnable, deployable site — not a
stub — with every conceptual page carrying real, library-computed figures.

## Decisions (locked during brainstorm)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Site location | `apps/docs/` (new `apps/*` workspace) | Keeps `docs/` as the markdown knowledge store; a deployable app is its own workspace package, consistent with `packages/*`. |
| Scope | Skeleton **+ full content** | Author all Guide + Reference pages this pass, not just stubs. |
| Charting | One Vue `IoFigure` component fed by **real** library output | Single source of truth; figures can't silently drift from the API. Zero extra chart deps. |
| Reference | **Hand-written**, curated markdown | Full control of voice/examples, matches the theme, no generic TypeDoc output. Accuracy comes from reading the actual `.ts`. |
| Deployment | **GitHub Pages + CI now** | Repo is public with Actions; makes the site real this pass. |
| Library consumption | `workspace:*` dependency on built `dist/` | Docs run the real published surface — the docs build becomes a live integration test of the public API. Cost: lib must build before docs. |

## Architecture

A new private workspace package `apps/docs` holding a VitePress site. The implementation breaks into
the numbered units below, each with a clear boundary:

1. **Workspace/build wiring** — makes `apps/docs` a pnpm package depending on `distribu-tron`.
2. **Site config** (`.vitepress/config.ts`) — IA, theme hookup, base path, fonts/favicons.
3. **`IoFigure` chart component** — the one reusable unit turning library output into Neon-Grid SVG.
4. **Content & IA** — Guide pages, Roadmap, home.
5. **Reference** — hand-written API pages.
6. **Deployment** — GitHub Pages CI.

Units 1–3 are infrastructure (prove the pipeline); 4–5 are content (the bulk of the effort); 6 ships
it. The plan should sequence them in that order.

The already-landed theme (`custom.css`, `index.js`), logos, favicons, and the
`vitepress-preview.html` visual reference are treated as **vendored**: config and the component
consume them; they are not re-derived. `vitepress-preview.html` is retained as the visual
acceptance target (open in a browser, compare against the live site).

### Repository / metadata facts

- Repo: `https://github.com/dm-p/distribu-tron` → Pages project site base path **`/distribu-tron/`**,
  published at `https://dm-p.github.io/distribu-tron/`.
- Toolchain: `pnpm@11.5.2`, Node ≥ 22 (matches root `packageManager`/`engines`).
- Public API surface (from `packages/distribu-tron/src/index.ts`):
  - `distribution`
  - descriptives: `mean, sum, min, max, range, variance, stdev, mode, mad, skewness, kurtosis`
  - quantiles: `quantile, median, quartiles, percentileRank`
  - `boxplot`
  - `ecdf, cdf`
  - `histogram, DEFAULT_MAX_AUTO_BINS`
  - `kde, silvermanBandwidth`
  - `summary`
  - `time` (from `profile`)
  - grouping: `group, summarize, groupedHistogram, groupedKde`
  - types via `export type * from "./types"`.

## Unit 1 — Workspace & build

- Add `"apps/*"` to `pnpm-workspace.yaml` (alongside existing `packages/*`, `docs`, `playground`).
- New `apps/docs/package.json`:
  - `private: true`, name `@distribu-tron/docs`, `type: module`.
  - scripts: `dev` (`vitepress dev`), `build` (`vitepress build`), `preview` (`vitepress preview`).
  - deps: `vitepress` (devDep) + `"distribu-tron": "workspace:*"`.
- Root `package.json`: add delegating `docs:dev` and `docs:build` scripts
  (`pnpm -C apps/docs dev|build`).
- **Build order invariant:** `distribu-tron` must be built (`dist/`) before `apps/docs` builds,
  because the docs import the package's `exports` (which point at `dist/index.js`). CI and local
  flow honor this (build lib → build docs).

## Unit 2 — VitePress config (`.vitepress/config.ts`)

Promote the vendored `config-snippet.ts` into a real `config.ts`, resolving its placeholders:

- `base: '/distribu-tron/'`.
- **Base-prefix the `head` favicon/font/icon links manually.** VitePress rewrites `themeConfig.logo`
  and in-markdown asset URLs for `base`, but raw `head` `<link>` hrefs (`/favicons/...`, `/logo.svg`)
  are **not** auto-prefixed — this is a known gotcha and must be handled explicitly.
- `socialLinks` → `https://github.com/dm-p/distribu-tron`.
- `markdown.theme`: `{ light: 'github-light', dark: 'material-theme-palenight' }` (as shipped).
- `appearance: true` (light/dark toggle, defaults dark).
- **`noindex` while building (temporary).** Add `['meta', { name: 'robots', content: 'noindex, nofollow' }]`
  to `head` so search engines skip the site during build/test. A `public/robots.txt` is **not** a
  reliable alternative here: on a project Pages site it deploys under `/distribu-tron/robots.txt`,
  but crawlers only honor robots.txt at the domain root (`dm-p.github.io/robots.txt`), which a
  shared `github.io` domain doesn't let us control. The meta tag works per-page regardless of path.
  Marked with a clear comment to **remove when the library is ready to go public**.
- Nav: **Guide / Reference / Roadmap**.
- Sidebar: the snippet's Introduction / Statistics / Grouping sections, **plus** a Reference section
  (see Unit 6).
- Fonts: prefer the `head` Google Fonts `<link>` tags from the snippet; if used, remove any
  duplicate `@import` in `custom.css` (per the theme README's note).

## Unit 3 — `IoFigure` component (signature unit)

Location: `.vitepress/theme/components/IoFigure.vue` + a pure helper `.vitepress/theme/charts.ts`.
Registered globally via `enhanceApp` in the existing `.vitepress/theme/index.js`.

**Purpose:** render the signature input→output figure from *real* library output, replacing the
preview's hardcoded `HIST` array and faked gaussian.

- **Props:**
  - `input` — a `WeightedValue[]` or `number[]` (or columnar `{ values, weights? }`).
  - `kind` — `'histogram' | 'kde' | 'ecdf'`.
  - optional `bins` / bandwidth options forwarded to the library.
  - optional `caption`.
- **Behavior:** imports `distribution` + `histogram`/`kde`/`ecdf` from `distribu-tron`, computes the
  plot-ready arrays, and renders:
  - left **input** panel — the source values (rendered as a small code/table view),
  - right **output** panel — an inline `<svg>` drawn by `charts.ts`.
- **`charts.ts`** is a generalized port of the preview's `bars()` / `kdeChart()` (and a new
  `ecdfChart()`): pure functions taking computed arrays → SVG path/element data. Fills use
  `var(--dt-c1)` / `var(--dt-c2)` so they recolor per light/dark theme (confirmed present in
  `custom.css`). No external chart dependency.
- **Markup/classes:** reuse the theme's `.dt-io`, `.dt-io-in`, `.dt-io-out`, `.dt-chart`,
  `.dt-io-head` classes (defined in `custom.css`).
- **Degenerate inputs:** follow the library's own contracts — empty / zero-mass input renders an
  empty-state figure rather than throwing; KDE with non-positive bandwidth renders empty.

## Unit 4 — Content & IA

Authored markdown derived from the existing root `README.md` and the actual source (not invented):

- **Home** `index.md` — VitePress home layout; hero copy adapted from `vitepress-preview.html`.
- **Guide** (`guide/`):
  - `what-is-it.md`, `getting-started.md`, `the-model.md` (the prepared-substrate model).
  - `descriptives.md`, `quantiles.md` (quantiles & box plot), `shape-density.md` (histogram/kde/ecdf).
  - `grouping.md` (group & ROLLUP), `summarize.md`, `grouped-plots.md`.
- **Roadmap** `roadmap.md` — distilled from
  `docs/designs/2026-06-08-package-design-and-roadmap.md`.
- Every conceptual page carries at least one real `<IoFigure>`.

## Unit 5 — Reference (hand-written)

`reference/index.md` (export-map overview) plus one page per source area, signatures/contracts read
from the actual `.ts`:

- `reference/distribution.md` — `distribution()`, the `Distribution` shape, input forms, `{ sorted }`.
- `reference/descriptives.md` — the 11 descriptive functions.
- `reference/quantiles-boxplot.md` — `quantile, median, quartiles, percentileRank, boxplot`.
- `reference/histogram-kde-ecdf.md` — `histogram, DEFAULT_MAX_AUTO_BINS, kde, silvermanBandwidth, ecdf, cdf`.
- `reference/grouping.md` — `group, summarize, groupedHistogram, groupedKde`.
- `reference/utilities.md` — `summary`, `time`.

Each entry documents signature, parameters, return shape, and the degenerate-input contract
(`NaN` / `[]` / `RangeError`) that the package guarantees.

## Unit 6 — Deployment

`.github/workflows/docs.yml`:

- Trigger: push to `main` (optionally `workflow_dispatch`).
- Permissions: `pages: write`, `id-token: write`.
- Steps: checkout → setup pnpm (pinned `11.5.2`) + Node 22 → `pnpm install` →
  build lib (`pnpm -C packages/distribu-tron build`) → build docs
  (`pnpm -C apps/docs build`) → `actions/upload-pages-artifact` (the VitePress
  `dist`) → `actions/deploy-pages`.
- Concurrency guard so overlapping pushes don't race the deploy.
- One-time: enable GitHub Pages "GitHub Actions" source in repo settings (out of band).
- After first deploy: add the site URL `https://dm-p.github.io/distribu-tron/` to the root
  `README.md`.

## Testing & verification

- **Primary:** `pnpm -C apps/docs build` must pass with **no dead links**. Because `IoFigure`
  imports the real library, an API break fails the docs build — the docs are a live integration test.
- **Unit:** a small `vitest` over the pure `charts.ts` path-math helpers (deterministic
  array→SVG-path output). Optional but keeps the renderer honest.
- **Visual:** manual screenshot pass of the running site against `vitepress-preview.html` (the
  acceptance target), light and dark.
- Existing package gates (lint/typecheck/test/build) remain unchanged and green.

## Out of scope

- TypeDoc / generated API docs.
- Alternative hosts (Netlify/Vercel) — Pages only.
- Search (Algolia / local) — can be a later addition.
- Versioned docs.
- Editing the vendored theme files (`custom.css`, favicons, logos) beyond what config/component
  consumption requires.

## Risks / known gotchas

- **`base` path on `head` links** — must manually prefix `/distribu-tron/` on favicon/font hrefs
  (VitePress won't). Wrong base = broken icons/assets on Pages.
- **Build ordering** — docs import built `dist`; forgetting to build the lib first yields a
  resolve error. CI encodes the order.
- **Content volume** — full Guide + Reference is the bulk of the effort; the plan should sequence
  infra (Units 1–3) before content (Units 4–5) so the pipeline is proven before pages are written.
