# Design — Docs reconciliation for KDE kernels (Gaussian default)

**Date:** 2026-06-10
**Branch:** `feat/docs-site` (main merged in)
**Status:** Approved (brainstorm) — pending implementation plan
**Depends on:** the KDE kernels feature merged to `main` (PR #3): Gaussian default, four kernels,
Scott bandwidth, `bandwidth` = kernel standard deviation.

## Motivation

`main` now ships a Gaussian-default KDE with selectable kernels and `bandwidth` redefined as the
kernel standard deviation. The docs site (`apps/docs`) still describes and renders the **old**
Epanechnikov-default behavior, and its KDE figures carry a now-obsolete `:bandwidth="15"` workaround
that existed only to hide the old jaggedness. With `main` merged into `feat/docs-site`, the docs must
be reconciled to the new library before the docs PR lands.

Empirical check (new library, exam-score dataset): `kde(d)` with pure defaults (Gaussian + Silverman
bandwidth 2.91) yields a clean unimodal curve (**1 extremum**). The bandwidth override is no longer
needed — the default now showcases itself.

## Decisions (locked in brainstorm)

| Decision | Choice |
| --- | --- |
| KDE figure bandwidth | **Drop the `:bandwidth` overrides**; render the Gaussian default. |
| Kernel showcase | Add a `kernel` prop to `IoFigure` **and** a kernel-comparison figure on shape-density. |
| Comparison form | **Small multiples** — four output-only mini-charts (one per kernel), shared input shown once. |
| Bézier render-smoothing | Becomes an opt-in **`smooth` prop on `IoFigure`, default `false`** (render the real `kde()` polyline). |
| Library | Unchanged — done on `main`. This branch is docs-only. |

## Components

### 1. `IoFigure.vue` — two new props
`apps/docs/.vitepress/theme/components/IoFigure.vue`

- `kernel?: KdeKernel` (default `"gaussian"`) — forwarded to `kde()` for `kind: "kde"`.
- `smooth?: boolean` (default `false`) — when false, the KDE output renders as the real `kde()`
  polyline (straight segments); when true, the quadratic-Bézier interpolation is applied.
- The existing `bandwidth` prop is retained. The `kde()` call becomes
  `kde(dist.value, { ...(bandwidth ? { bandwidth } : {}), ...(kernel ? { kernel } : {}) })`.
- `KdeKernel` is imported as a type from `distribu-tron` (now exported).

### 2. `charts.ts` — parameterize smoothing
`apps/docs/.vitepress/theme/charts.ts`

- `kdeCurve(points, geo = DEFAULT_GEOMETRY, smooth = false): CurveView`.
  - `smooth === false` (default): straight `L` segments — the honest pre-Bézier rendering, restored
    as the default path.
  - `smooth === true`: the quadratic-Bézier-through-midpoints path (the current behavior, kept).
- `ecdfStep`/`histogramBars` unchanged.

### 3. `KernelComparison.vue` — new small-multiples component
`apps/docs/.vitepress/theme/components/KernelComparison.vue`

- Props: `input: DistributionInput`, optional `bandwidth`, optional `caption`.
- Computes `kde(distribution(input), { kernel })` for each of `["gaussian","epanechnikov","triangular","cosine"]`
  on the SAME sample grid (derive once, reuse — so the four mini-charts share an x-axis), renders four
  output-only mini-SVGs via `charts.ts` `kdeCurve(points, geo, false)`, each labelled with the kernel
  name. The shared input is shown once above the row (compact; not the full `.dt-io` input panel four
  times).
- Registered globally in `.vitepress/theme/index.js` alongside `IoFigure`.
- Uses the vendored theme classes / `--dt-c1`/`--dt-c2` vars; no new palette colors.

### 4. Content updates
- **`apps/docs/guide/shape-density.md`** — rewrite the `kde` section for the new API (Gaussian
  default; `kernel: "gaussian" | "epanechnikov" | "triangular" | "cosine"`; `bandwidth` = kernel SD
  with `"silverman"` default and `"scott"`; `resolution` default 50; `silvermanBandwidth`/`scottBandwidth`).
  Drop `:bandwidth="15"` on the existing KDE `IoFigure` (use the Gaussian default). Add the
  `<KernelComparison>` block. Add a short migration note (default kernel change; numeric bandwidth now SD).
- **`apps/docs/guide/descriptives.md`** — drop `:bandwidth="15"` on its KDE `IoFigure` (Gaussian
  default is smooth).
- **`apps/docs/reference/histogram-kde-ecdf.md`** — update `kde` options (`kernel`, `bandwidth` SD +
  `"scott"`, `resolution` 50, `kernel` list), document `scottBandwidth(n, sd)`, and correct/keep the
  `silvermanBandwidth(n, iqr, sd)` signature; mention the `KdeKernel` type.
- **`apps/docs/reference/index.md`** — add `scottBandwidth` and the `KdeKernel` type to the export map.

## Data flow

`IoFigure` / `KernelComparison` → `distribution(input)` → `kde(d, { kernel, bandwidth })` (real,
merged library) → `charts.ts` (`kdeCurve(points, geo, smooth)`) → inline SVG. Because figures render
the real library at SSR build time, an API mismatch fails the docs build — the build is the
integration check.

## Testing / verification

- **`charts.spec.ts`** (extend): `kdeCurve(pts, geo, true)` produces a Bézier path (contains `" Q "`);
  `kdeCurve(pts, geo, false)` (and the default) produces straight `L` segments (no `" Q "`); both start
  `M `, area closes `Z`, empty → `""`.
- **Docs build is the gate**: `pnpm -C apps/docs build` (run as `cd apps/docs && pnpm build`) must pass
  with no dead links and SSR-render every figure (including `KernelComparison`) against the merged
  library. Requires the library built first (`cd packages/distribu-tron && pnpm build`).
- **Visual pass**: the now-default KDE figures (smooth Gaussian) and the kernel comparison (gaussian
  smooth, triangular visibly bumpier) in light + dark.

## Out of scope

- Any library change (done on `main`).
- The `main`→`feat/docs-site` merge commit (signed by the user, separately).
- A 4-curve overlay chart / new palette colors (we chose small multiples).
- Re-deploying the docs site (handled when the docs PR merges).

## Risks / notes

- **Smooth default flips to off**: the existing shape-density/descriptives KDE figures currently rely
  on Bézier smoothing; after this change they render straight segments. The Gaussian default at
  resolution 50 (~65 points) is smooth enough that straight segments look clean — verify in the visual
  pass; if a specific figure wants extra polish, set `smooth` on that one figure.
- **Shared grid in `KernelComparison`**: compute the sample grid once (e.g. from the gaussian KDE or an
  explicit `samplePoints`) and pass it to all four `kde()` calls so the mini-charts align on x.
