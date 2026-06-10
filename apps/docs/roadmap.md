# Roadmap

`distribu-tron` is designed to be extended incrementally. The API surface ships with
reserved option slots so later phases slot in without breaking signatures.

## Current capabilities

The library is in active beta. The full v1 API surface is shipped and stable:

**Core substrate**

- `distribution()` — normalises any supported input (`WeightedValue[]`, `number[]`, or
  columnar `{ values, weights? }`) into an immutable sorted `Distribution`. Validates,
  deduplicates, and precomputes the cumulative weight array used for O(log n) quantile
  lookups. An optional `{ sorted: true }` fast path skips aggregation/sort for
  already-ordered data.

**Descriptives**

- `mean()`, `sum()`, `min()`, `max()`, `range()`
- `variance()`, `stdev()` (population by default; `{ sample: true }` for n−1 correction)
- `mode()`, `mad()`, `skewness()`, `kurtosis()` (excess)
- `summary()` — all scalar descriptives and quartiles in a single call

**Quantiles and box plot**

- `quantile()` with five interpolation methods (`linear`, `lower`, `higher`, `nearest`,
  `midpoint`); `median()`; `quartiles()`; `percentileRank()`
- `boxplot()` — fences, IQR, and outlier array; configurable whisker multiplier

**Shape and density**

- `histogram()` — Freedman–Diaconis auto-binning (capped), or explicit `binCount` /
  `edges`
- `kde()` — four kernels (gaussian default, plus epanechnikov / triangular / cosine), Silverman or
  Scott bandwidth (or manual), configurable resolution and clamping
- `ecdf()`, `cdf()` — empirical CDF step points and point-in-time CDF value

**Grouping and ROLLUP**

- `group()` — buckets row data into one `Distribution` per key, with optional hierarchical
  prefix-ROLLUP subtotals and a grand-total rollup (tagged by `level` / `depth`)
- `summarize()` — group-tagged descriptive rows, ready for tables
- `groupedHistogram()`, `groupedKde()` — shared bin edges and bandwidth derived once from
  the overall distribution so series align cleanly for overlay or facet charts

**Utilities**

- `silvermanBandwidth()` — the Silverman rule exposed for manual use
- `time()` — opt-in one-shot call timing; the core functions are measurement-free
- `DEFAULT_MAX_AUTO_BINS` — the exported cap constant for the auto-histogram rule

## Planned / under consideration

The following phases are drawn directly from the design spec. All slot into existing
reserved option fields (`HistogramOptions.rule`, etc.) without changing existing signatures.

**Phase 2 — additional density estimation**

Cross-validation bandwidth selection, exposed via the `KdeOptions.bandwidth` slot. (KDE
kernels — gaussian, epanechnikov, triangular, cosine — and the Scott bandwidth selector
have already shipped.)

**Phase 3 — additional binning rules**

Sturges, Doane, Rice, and Scott binning rules; equal-frequency (quantile) bins; log-scale
bins. All via the reserved `rule` and `scale` slots in `HistogramOptions`.

**Phase 4 — inference and comparison**

Weighted confidence intervals, weighted t-test, two-sample `compare(d1, d2)`, weighted
correlation, and effect sizes — a `DescrStatsW`-style inference layer for JS.

**Phase 5 — grouping extras**

Full `CUBE` / arbitrary grouping-sets (beyond v1's prefix `ROLLUP`), and richer per-level
subtotal-label formatting if the single `totalLabel` proves limiting.

**Adapters**

A separate `@distribu-tron/vega` workspace package that converts the plot-ready arrays
the core emits into Vega-Lite specs. The core itself will never import a charting grammar.

---

> Feature requests and use-case reports are welcome as GitHub issues.
