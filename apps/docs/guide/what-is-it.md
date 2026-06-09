# What is distribu-tron?

`distribu-tron` is a zero-runtime-dependency, ESM-only, TypeScript-first library for **weighted,
plot-ready distribution statistics**. Hand it a frequency table — the output of a database/engine
`GROUP BY` (Power BI DAX, SQL, DuckDB), or just raw values — and get back plot-ready descriptives,
quantiles, box plots, histograms, ECDFs, and kernel density estimates, plus grouped and ROLLUP
variants. It computes a full stats pipeline **directly on weighted / pre-aggregated input**, so you
never have to re-explode a `{ value, weight }` table back into the millions of raw observations it
represents.

## When to use it — and when not to

`distribu-tron` is built for one job: statistics over data that is **already aggregated** (a
frequency table). It is **not** a faster drop-in for raw-array stats.

### Where you'll get the most value

**Aggregated or weighted input.** When data arrives as a `{ value, weight }` table (the output of a
SQL/DAX `GROUP BY`), a flat-array library must first _re-expand_ it into the raw observations it
represents, then sort. `distribu-tron` reads it directly. From a 1,000-row frequency table
(≈ 1,000,000 observations), a p50 quantile is **~425× faster than d3-array** and **~590× faster
than simple-statistics**; a histogram from the same table is **~180×** faster. And with _fractional_
weights — importance, not integer counts — the others can't expand at all, since they don't compute
weighted statistics. That gap, plus a roughly 50× smaller working set (distinct values, not every
observation), is the entire reason this library exists.

### Where either path is fine

**The prepared hot path.** Given each library's prepared form, a single quantile is a wash (all in
the tens of millions of ops/s): the O(log k) cumulative-weight search versus an O(1) array index
sits below the noise floor.

### Where conventional libraries win

**Raw, one-shot.** Starting from a raw, unweighted array and needing a single number,
[`simple-statistics`](https://github.com/simple-statistics/simple-statistics) and
[`d3-array`](https://github.com/d3/d3-array) are faster and lighter — a single p50 quantile is about
8× faster, a histogram about 3.2× faster. Use them for that.

**The rule of thumb:** prepare once from aggregated/weighted input, then read many different
statistics off the same substrate. If you only need one number from a flat array, this is the wrong
tool.

## Feature tour

The public surface (see [The model](./the-model) for the prepared-substrate design):

- **`distribution()`** — normalize any supported input into an immutable, prepared `Distribution`.
- **Descriptives** — `mean`, `sum`, `min`, `max`, `range`, `variance`, `stdev`, `mode`, `mad`,
  `skewness`, `kurtosis`.
- **Quantiles** — `quantile` (five methods), `median`, `quartiles`, `percentileRank`.
- **Box plot** — `boxplot` (Tukey fences, whisker-adjacent values, outliers).
- **Shape & density** — `histogram` (Freedman–Diaconis auto-binning), `kde` (Epanechnikov KDE with
  Silverman bandwidth, plus `silvermanBandwidth`), `ecdf` / `cdf`.
- **Summary** — `summary`, a single object of the common descriptives + quartiles.
- **Grouping** — `group` (per-key distributions with optional prefix-ROLLUP subtotals and grand
  total), `summarize`, `groupedHistogram`, `groupedKde` (shared-domain grouped consumers).

Every reader is a tree-shakable free function that takes a `Distribution` and never re-sorts or
re-aggregates.
