# distribu-tron — Package Design & Roadmap

**Date:** 2026-06-08
**Status:** Approved for planning
**Working name:** `distribu-tron` (verify npm availability before publish; fall back to a scope like `@dmp/distribu-tron` if taken)

> This spec designs a **new, standalone, externally-published npm package**. It will be
> developed in its own repository, published to npm, then consumed back into
> `rayfin-distribution-stats` (replacing the current `src/lib/distribution/` seed). This
> design doc currently lives in the app repo because the package repo does not exist yet;
> the implementation plan's first task creates the package repo and moves this spec there.

## Goal

A fast, zero-runtime-dependency, TypeScript-first library for **weighted / pre-aggregated
distribution statistics**. Hand it a frequency table — the output of a database/engine
`GROUP BY` (Power BI DAX, SQL, DuckDB), or raw values — and get back plot-ready
descriptives, quantiles, histograms, and density estimates.

**Positioning (validated by market research):** the only maintained JS library that
computes a *full stats pipeline* on weighted/pre-aggregated input. Sold as the pipeline,
not "a KDE library." See `2026-06-05`-era research: no maintained JS package accepts a
`{value, weight}` frequency table for weighted quantiles / stddev / KDE / histogram;
Python has it (`statsmodels.DescrStatsW`, weighted `scipy`/`KDEpy`, `numpy` 2.0 weighted
quantiles) but JS does not.

**Scope boundary:** the core computes numbers and emits plain plot-ready arrays. It never
imports a charting grammar. Vega-Lite (and other) adapters are separate optional packages
on the roadmap.

## Core model

The shared substrate every function reads from. Built once, read many times.

```ts
/** A value paired with a non-negative weight (integer frequency or fractional importance). */
export interface WeightedValue {
    value: number;
    weight: number;
}

export type DistributionInput =
    | WeightedValue[]                                                 // the core frequency table
    | number[]                                                        // raw values (weight 1 each), auto-aggregated
    | { values: ArrayLike<number>; weights?: ArrayLike<number> };     // columnar / TypedArray

export interface DistributionOptions {
    /** Skip the internal sort when the caller guarantees ascending order. */
    sorted?: boolean;
    /** Capture a prep-phase timing breakdown on `.timings` (off = zero measurement overhead). */
    profile?: boolean;
}

export function distribution(input: DistributionInput, options?: DistributionOptions): Distribution;

export interface Distribution {
    readonly size: number;          // count of distinct values
    readonly n: number;             // total weight (Σ weight)
    readonly min: number;
    readonly max: number;
    readonly values: Float64Array;  // sorted ascending; internal substrate, exposed read-only
    readonly weights: Float64Array; // aligned to `values`
    readonly cumulative: Float64Array; // running Σ weight, for O(log n) quantiles
    /** Present only when constructed with `{ profile: true }`. */
    readonly timings?: PrepTimings;
}

export interface PrepTimings {
    validateMs: number;
    aggregateMs: number; // raw/columnar → frequency table (0 when already a table)
    sortMs: number;      // 0 when `sorted: true`
    totalMs: number;
}
```

`distribution()` responsibilities, in order:
1. **Validate** (fail-fast): reject negative or `NaN` weights and non-finite values with
   `TypeError`/`RangeError`.
2. **Normalize input** to aligned `Float64Array`s: `WeightedValue[]` and columnar pass
   through; `number[]` is aggregated to a frequency table; duplicate values are merged.
3. **Sort** ascending unless `sorted: true`.
4. **Precompute** `n`, `min`, `max`, and the `cumulative` array.

**Numeric robustness** (a first-class "fast *and* accurate" property): use pairwise/Kahan
summation for sums and moments, and a numerically stable weighted variance, so results
hold up at very large `n` where naive accumulation drifts. This is a tested, advertised
guarantee, not an implementation detail.

## v1 API surface

Every function is a tree-shakeable named export taking a `Distribution` (or a raw
`DistributionInput`, which it auto-prepares for one-offs).

### Descriptives
- `mean(d)`, `sum(d)`
- `variance(d, { sample?: boolean })`, `stdev(d, { sample?: boolean })` — **default
  population** (a frequency table is the whole population); `sample: true` uses the n−1
  correction.
- `min(d)`, `max(d)`, `range(d)`
- `mode(d) → number` — the value carrying the maximum weight (ties → the smallest such
  value, for determinism; a multi-modal `modes(d) → number[]` is roadmap)
- `mad(d)` — median absolute deviation
- `skewness(d)`, `kurtosis(d)` — weighted moments; kurtosis is **excess** (normal = 0)

### Quantiles & box plot
- `quantile(d, p, { method?: QuantileMethod })` — `p ∈ [0, 1]`; **default `method:
  "linear"`** (type-7, matches NumPy/`d3.quantile`). Other methods: `"lower"`,
  `"higher"`, `"nearest"`, `"midpoint"`.
- `median(d)`
- `quartiles(d) → { q1, q2, q3, iqr }`
- `percentileRank(d, value) → number` (the `p ∈ [0, 1]` for a value)
- `boxplot(d, { whisker?: number }) → { min, q1, median, q3, max, iqr, lowerFence,
  upperFence, outliers: number[] }` — `whisker` defaults to 1.5 (IQR fence multiplier)

### Shape & density
- `ecdf(d) → { x: number; p: number }[]` — empirical CDF step points
- `cdf(d, value) → number`
- `histogram(d, options?) → Bin[]` where `Bin = { x0: number; x1: number; weight: number }`
- `kde(d, options?) → KdePoint[]` where `KdePoint = { x: number; density: number }`

### Convenience
- `summary(d) → SummaryStatistics` — the scalar descriptives + quartiles in one call:
  `{ n, size, mean, stdev, min, max, range, mode, mad, skewness, kurtosis, q1, median, q3,
  iqr }`. Histogram and KDE stay explicit (they carry options and are heavier).

### Profiling helper
- `time<T>(fn: () => T) → { value: T; ms: number }` — a tiny opt-in wrapper for one-off
  call timing. The core functions never self-measure.

### Options carry reserved extensibility slots (so the roadmap is non-breaking)

```ts
export type QuantileMethod = "linear" | "lower" | "higher" | "nearest" | "midpoint";

export interface HistogramOptions {
    binCount?: number;                 // manual count (not capped)
    maxBins?: number;                  // cap for auto rules (default keeps bars readable)
    rule?: "fd";                       // v1: Freedman–Diaconis (Scott fallback internally).
                                       // RESERVED for "scott" | "sturges" | "doane" | "rice"
    edges?: number[];                  // explicit boundaries; override the rule (shared-domain seam — used by groupedHistogram)
    // RESERVED: scale?: "linear" | "log"; mode?: "width" | "frequency"
}

export interface KdeOptions {
    bandwidth?: number | "silverman";  // v1 default "silverman"; manual number allowed
    resolution?: number;               // sample-point count (the Low→Ultra scale lives in the app)
    clamp?: boolean;                   // trim the curve to [min, max]
    samplePoints?: ArrayLike<number>;  // explicit x positions; override domain derivation (shared-domain seam — used by groupedKde)
    kernel?: "epanechnikov";           // v1: Epanechnikov. RESERVED for "gaussian" | "triangular" | "cosine"
    // RESERVED: bandwidth?: ... | "scott" | "cv"
}
```

The auto-histogram keeps the app's hard-won behavior: Freedman–Diaconis count, **capped**
(`maxBins`), with boundary steps rounded **up** to a 1/2/5×10ⁿ value so the bin count
never overshoots the target (the lesson from the 313-bin bug).

### Grouped / orthogonal distributions (v1)

A single `Distribution` is the primitive; grouping is **many distributions + hierarchical
rollups**, built by a `group()` factory and consumed by group-aware helpers. The core
`Distribution` is unchanged.

```ts
function group(rows: ReadonlyArray<Record<string, unknown>>, spec: {
    by: string | string[];                       // dimension field(s): "category" or ["category","series"]
    value: string | ((row) => number);
    weight?: string | ((row) => number);         // default 1
    rollup?: boolean;                            // hierarchical (prefix ROLLUP) subtotals. default false
    totalLabel?: string | null;                  // cosmetic mark for rolled-up dims. default null
    sorted?: boolean;
}): GroupedDistribution;

interface GroupedDistribution {
    readonly dimensions: string[];               // e.g. ["category","series"] (order = rollup hierarchy)
    readonly groups: DistributionGroup[];        // every level present: leaves (+ subtotals + grand total when rollup)
    readonly leaves: DistributionGroup[];        // convenience: finest-level groups only
    readonly overall: Distribution;              // convenience: the grand-total rollup distribution
}

interface DistributionGroup {
    readonly key: Record<string, string | number | null>; // rolled-up dims = totalLabel (or null)
    readonly level: string[];      // dimensions ACTIVE (not rolled up) here — canonical, collision-proof
    readonly depth: number;        // = level.length; 0 = grand total, dimensions.length = leaf
    readonly distribution: Distribution;
}
```

**Rollup semantics (ROLLUP / hierarchical prefix).** `by: [category, series]` with
`rollup: true` yields the leaves (category×series) **plus** a subtotal per category
**plus** the grand total — N+1 levels. The *order* of `by` defines the hierarchy
(`[category, series]` ≠ `[series, category]`). Full `CUBE` / arbitrary grouping-sets are
roadmap, not v1. Subtotals are computed by merging child leaf frequency tables up the
hierarchy (cheap), not by re-scanning rows.

**Disambiguation (critical).** A rolled-up dimension is *cosmetically* marked with
`totalLabel` (or `null`), but the **canonical** way to tell a subtotal from a leaf — and
from a value that genuinely equals the label — is the structured `level` / `depth` field,
never the key string. This mirrors SQL's `GROUPING()`; it is always present, not optional.
Per-level display wording is the consumer's job (switch on `level`); the core ships one
label only.

**Consumers:**
- `summarize(gd, { includeOverall? }) → (SummaryStatistics & key fields & { depth })[]` —
  group-tagged rows for tables. With `rollup` on this naturally includes subtotals + grand
  total (they are groups); `includeOverall` adds the grand total when `rollup` is off.
- Any scalar free function maps over `gd.groups` / `gd.leaves`.
- `groupedHistogram(gd, opts?) → (Bin & key fields & { depth })[]` and
  `groupedKde(gd, opts?) → (KdePoint & key fields & { depth })[]` — the shared bin
  **edges** / sample-points + bandwidth are derived **once from `gd.overall`** and reused
  for every group, so series align for overlay/facet. Output is flat, with dimension fields
  spread in (Vega-ready) plus the structured `depth`.

**Plot default = leaves only.** `groupedHistogram` / `groupedKde` emit only the finest
level by default; subtotal/grand-total series are opt-in via
`{ includeSubtotals?: boolean; includeOverall?: boolean }`. This prevents
double-counted overlays (a category subtotal curve = the sum of its series curves).
`summarize` (a table) includes all levels by default. Note: spreading dimension fields
into plot/summary rows risks collision if a dimension is literally named `x0`/`x1`/
`weight`/`density`/`depth` — those are documented reserved field names (the alternative,
nesting under `group: {...}`, is rejected as less Vega-friendly).

## Roadmap (phased; v1 = above)

Later phases slot into the reserved option slots without changing signatures.

- **Phase 2 · density** — kernels (Gaussian, triangular, cosine) + bandwidth selectors
  (Scott, cross-validation) via `KdeOptions.kernel` / `bandwidth`.
- **Phase 3 · binning** — equal-frequency (quantile) bins, Sturges/Doane/Rice/Scott rules,
  log-scale bins, custom edges via `HistogramOptions.rule` / `edges` / `scale`.
- **Phase 4 · inference & comparison** — weighted confidence intervals & t-test
  (`DescrStatsW`-style), two-sample `compare(d1, d2)`, weighted correlation, effect sizes.
- **Phase 5 · grouping extras** — `CUBE` / arbitrary grouping-sets (beyond v1's prefix
  `ROLLUP`), and richer per-level label formatting if the single `totalLabel` proves
  limiting.
- **Adapters** — `@distribu-tron/vega` (separate workspace package): plot-ready arrays →
  Vega-Lite specs.

## Quality & delivery

### Error handling
- Malformed input → fail-fast `TypeError` / `RangeError` (negative/`NaN` weight,
  non-finite value, `p ∉ [0, 1]`, non-positive `binCount`).
- An **empty** distribution is valid and returns well-defined empties: scalar functions
  return `NaN` (min `+Inf`, max `−Inf`), array functions return `[]`. No throws for empty.

### Testing
- Per-function unit tests with hand-computed fixtures and edge cases (empty, single value,
  all-equal, two values; quantile boundaries; fractional weights).
- Property tests: quantile monotonicity in `p`, weights conserved through histogram,
  `ecdf` reaches 1.0.
- **Parity tests vs Python** (`statsmodels.DescrStatsW`, `numpy`) on a handful of fixtures
  to back correctness claims (committed expected values; no Python at test time).
- Optimization-equivalence tests carried over from the seed (windowed KDE == naïve;
  linear-merge binning == nested).
- Grouping/rollup tests: `overall` equals a single distribution over all rows; a category
  subtotal equals the merge of its leaf groups; every group in `groupedHistogram` shares
  identical edges; `level`/`depth` correctly distinguishes a subtotal from a leaf whose
  value equals `totalLabel`; plot helpers emit leaves-only by default.

### Benchmarks (the advertised numbers)
- A `tinybench` (or `vitest bench`) suite in the package comparing against `d3-array` and
  `simple-statistics` across data sizes; output a README ops/sec table. This — not runtime
  telemetry — is the source of any "Nx faster" claim. Core stays measurement-free.

### Build & publish
- **ESM-only.** No CJS (Node 22.12+ can `require()` ESM; bundlers consume ESM; the lib is
  stateless so there is no dual-package hazard; CJS can be added later non-breakingly if
  adoption friction appears).
- `tsup` → ESM output + bundled `.d.ts`, `exports` map, `sideEffects: false`, npm
  provenance. ISC attribution banner retained for the vendored `ticks`/`nice` (from
  d3-array).
- Per-concern entry points are not required for v1 (a single tree-shakeable barrel is
  enough); subpath exports can be added later.

### Repository structure (pnpm workspace — lean monorepo)
Only the library is a published package at first; docs, playground, and the future adapter
slot in as workspace members so there is never a single→mono migration.

```
distribu-tron/                  (repo root)
├─ pnpm-workspace.yaml
├─ packages/
│  └─ distribu-tron/            the published library (src, tests, bench, tsup config)
├─ docs/                        RESERVED — VitePress guide + TypeDoc API reference
├─ playground/                  RESERVED — Vite app (or a StackBlitz link) for live demos
└─ .github/workflows/          CI: test + lint + build; deploy docs to GH Pages on main
```

- **Docs (reserved, not built in v1):** VitePress for the markdown guide + TypeDoc for an
  API reference generated from TSDoc comments (always in sync), deployed to GitHub Pages by
  a GitHub Actions workflow on push to `main`. Near-zero ongoing maintenance.
- **Playground (reserved):** a small Vite app deployed alongside the docs, or a StackBlitz
  template link for zero hosting. Not built in v1.
- Turborepo / changesets are intentionally **not** adopted until there is genuinely more
  than one published package.

### Consume-back into rayfin-distribution-stats
Once published, this app replaces `src/lib/distribution/` with the package:
- The DAX adapter maps the existing `DistinctValue { value, count }` → `{ value, weight }`
  (drop the blank/null row as today) and constructs the distribution with `sorted: true`
  (the DAX path already sorts ascending).
- App call sites move from `computeStatistics/computeBins/computeKde` to
  `distribution()` + the free functions (`summary`/`quartiles`, `histogram`, `kde`).
- **Behavior shift to expect:** `quantile`'s default `linear` interpolation will change the
  displayed median/quartiles slightly versus the seed's nearest-rank. This is intended
  (more standard); there is no DAX percentile to contradict it (those were redacted for
  OOM, so the client is the source of truth).

## Out of scope (v1)
- Charting adapters (separate roadmap packages).
- Additional kernels / bandwidth selectors / binning rules / inference (roadmap phases 2–4).
- `CUBE` / arbitrary grouping-sets and per-level subtotal-label formatting (roadmap phase 5);
  v1 grouping is prefix `ROLLUP` with a single `totalLabel`.
- Building the docs site or playground (structure reserved only).
- CJS builds, Turborepo, changesets.

## Dependencies
No runtime dependencies. `ticks`/`nice` remain vendored (ISC, attributed). Dev-only:
`tsup`, `tinybench`/`vitest`, `typescript`; docs/playground dev deps are isolated in their
own workspace members when added.
