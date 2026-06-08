# distribu-tron

**Weighted, plot-ready distribution statistics from a frequency table.**

Hand it a frequency table - the output of a database/engine `GROUP BY` (Power BI DAX, SQL,
DuckDB), or just raw values - and get back plot-ready descriptives, quantiles, box plots,
histograms, ECDFs, and kernel density estimates. Zero runtime dependencies, ESM-only,
TypeScript-first.

```ts
import { distribution, summary, quantile, histogram } from "distribu-tron";

// A frequency table: each value carries a non-negative weight (a count, or fractional importance).
const d = distribution([
  { value: 10, weight: 1203 },
  { value: 20, weight: 2310 },
  { value: 24, weight: 145 },
]);

quantile(d, 0.5);   // weighted median (type-7 linear by default)
summary(d);         // { n, mean, stdev, median, q1, q3, iqr, skewness, kurtosis, ... }
histogram(d);       // [{ x0, x1, weight }, ...] with sensible auto-bins
```

- Useful for... **when your data is already aggregated or weighted** - a `{ value, weight }` frequency table from a `GROUP BY`, or values with fractional importance - and you'll read several statistics off it.
- Less useful for... **when you have a raw, unweighted array and need a single number**; `simple-statistics` or `d3-array` are faster and lighter for that. The [Performance](#performance---and-when-not-to-use-this) section below has the numbers.

## Purpose

Almost every JS stats library assumes **raw, unit-weight samples**. But real analytical data
is already aggregated - a `GROUP BY value` gives you `{ value, count }` rows, not a flat array. To compute something as simple as a median with a conventional library, you'd have to re-explode that table back into the millions of raw values it represents: wasteful, and often impossible within memory limits, particularly on hosted/serverless platforms.

`distribu-tron` computes a **full stats pipeline directly on weighted / pre-aggregated input**. The core emits plain plot-ready arrays and never imports a charting grammar; chart adapters are separate, optional packages on the roadmap - though the plain plot-ready arrays feed straight into any charting library in the meantime.

## Install

```sh
pnpm add distribu-tron   # or: npm i distribu-tron / yarn add distribu-tron
```

Requires Node ≥ 22. ESM-only (`import`, no `require`).

## The model

`distribution()` normalizes any supported input into a prepared, immutable `Distribution`
(sorted, distinct, `Float64Array` substrate + cumulative weights). You build it **once** and
read it **many** times with tree-shakable free functions.

```ts
// All three inputs produce an equivalent Distribution:
distribution([
  { value: 5, weight: 3 },
  { value: 9, weight: 1 },
]);                                                 // frequency table
distribution([5, 5, 5, 9]);                         // raw values (auto-aggregated, weight 1 each)
distribution({ values: [5, 9], weights: [3, 1] });  // columnar / TypedArray

// Already sorted & distinct (e.g., straight from SQL `GROUP BY value ORDER BY value`)?
// Skip the internal sort/aggregate:
distribution(rows, { sorted: true });
```

`Distribution` exposes `size` (distinct count), `n` (total weight, **Σ weight**), `min`, `max`,
and the read-only `values` / `weights` / `cumulative` arrays.

## What you get

```ts
import {
  // descriptives
  mean, sum, min, max, range, variance, stdev, mode, mad, skewness, kurtosis,
  // quantiles & box plot
  quantile, median, quartiles, percentileRank, boxplot,
  // shape & density
  ecdf, cdf, histogram, kde, silvermanBandwidth,
  // aggregate
  summary,
  // grouping
  group, summarize, groupedHistogram, groupedKde,
  // profiling
  time,
} from "distribu-tron";
```

- **Descriptives** - weighted mean/sum/variance/stdev (population by default, `{ sample: true }`
  for n−1), mode, median absolute deviation, skewness, excess kurtosis. Numerically stable
  (Neumaier compensated summation) so results hold at very large `n` where naive accumulation drifts.
- **Quantiles** - weighted `quantile(d, p, { method })` (type-7 `linear` default, plus
  `lower`/`higher`/`nearest`/`midpoint`), `median`, `quartiles`, `percentileRank`, and `boxplot`
  with 1.5·IQR fences + outliers.
- **Shape & density** - `ecdf`/`cdf`, a capped Freedman–Diaconis `histogram` (weights conserved;
  explicit `edges` supported), and a windowed Epanechnikov `kde` with Silverman bandwidth.

> **Quantiles treat weights as frequencies** - `Σweight` is the effective sample size (type-7). Probability /
> importance weights that sum to ≈1 collapse every quantile to the smallest value; scale them to count
> magnitude first (e.g. `× 1000`), or use the scale-invariant `percentileRank` / `cdf`. (`histogram`, `kde`,
> `ecdf`, and `mad` are already scale-invariant.)

### Grouping with ROLLUP

`group()` turns a row set into one `Distribution` per key, with optional hierarchical subtotals
and a grand total, like SQL `GROUP BY ... WITH ROLLUP`. The grouped plot helpers share one
domain (identical histogram edges / KDE sample points) across every series, so they overlay cleanly.

```ts
import { group, summarize, groupedHistogram } from "distribu-tron";

const rows = [
  { category: "Bikes", series: "2024", value: 20, weight: 1200 },
  { category: "Bikes", series: "2025", value: 24, weight: 145 },
  { category: "Accessories", series: "2024", value: 10, weight: 1203 },
  { category: "Accessories", series: "2025", value: 10, weight: 540 },
];

const gd = group(rows, {
  by: ["category", "series"],
  value: "value",
  weight: "weight",
  rollup: true,
  totalLabel: "(All)",
});

summarize(gd);                                  // one stats row per leaf + subtotal + grand total,
                                                // tagged with level/depth

groupedHistogram(gd);                           // leaves only, shared bin edges, ready to
                                                // stack/overlay

groupedHistogram(gd, { includeOverall: true }); // add the grand-total series
```

Each group is tagged with its `key`, plus `level`/`depth` so you can tell a `"(All)"` subtotal
apart from a leaf whose value happens to equal the total label.

> **Reserved field names:** grouped helpers flatten the group key onto each output row, so don't
> name a grouping dimension after an output field (`weight`, `x`, `density`, `n`, `min`, `max`,
> `median`, `depth`) - the key would overwrite it.

## Empty & malformed input

- An **empty** distribution is valid: scalar functions return `NaN` (`min` `+Infinity`, `max`
  `−Infinity`), array functions return `[]`. No throws.
- Malformed input fails fast: negative/`NaN` weights, non-finite values, mismatched columnar
  lengths, and `p ∉ [0, 1]` throw `RangeError`.

## Performance - and when _not_ to use this

`distribu-tron` is built for one job: statistics over data that is **already aggregated** (a
frequency table). It is **not** a faster drop-in for raw-array stats. For a one-shot computation on
a flat array, reach for [`simple-statistics`](https://github.com/simple-statistics/simple-statistics)
or [`d3-array`](https://github.com/d3/d3-array) instead. They're faster and lighter for that job.

The benchmark below (`pnpm bench`, N = 100k observations, single machine) makes the trade-off explicit.

### Where you'll get the most value

**Aggregated/weighted input.** When data arrives as a `{ value, weight }` table (the output of a SQL/DAX `GROUP BY`), a flat-array library must first _re-expand_ it into the raw observations it represents, then sort. `distribu-tron` reads it directly:

| p50 quantile, from a 1,000-row frequency table (= 1,000,000 observations) |       ops/s |
| ------------------------------------------------------------------------- | ----------: |
| **distribu-tron**: `distribution(table, { sorted: true })`                | **~64,600** |
| d3-array: expand → `quantileSorted`                                       |        ~152 |
| simple-statistics: expand → `quantile`                                    |        ~110 |

→ **~425× faster than d3-array, ~590× faster than simple-statistics**; histogram from the same table is **~180×** faster. And with _fractional_ weights (importance, not integer counts) the others can't expand at all - they don't compute weighted statistics. That gap, plus a ~50× smaller working set (distinct values, not every observation), is the entire reason this library exists.

### Where you'll be OK with either path

**The prepared hot path.** Given each library's prepared form, a single quantile
is a wash (all ~19–21M ops/s); our O(log k) cumulative-weight search vs an O(1) array index sits
below the noise floor.

### Where you'll be better off opting for conventional libraries

**Raw, one-shot.** Starting from a raw 100k array, the others are faster. Use them:

| task, from a raw array        | fastest                         | vs distribu-tron |
| ----------------------------- | ------------------------------- | ---------------: |
| single p50 quantile           | simple-statistics (quickselect) |   **~8× faster** |
| four quantiles (p10/50/90/99) | d3-array (`quantileSorted`)     | **~2.4× faster** |
| histogram                     | d3-array (`bin`)                | **~3.2× faster** |

### The rule of thumb

**Prepare once from aggregated/weighted input, then read many different statistics
off the same substrate.** If you only need one number from a flat array, this is the wrong tool.

## Roadmap

Later phases slot into reserved option slots without breaking signatures:

- **Density**: more kernels (Gaussian, triangular, cosine) and bandwidth selectors.
- **Binning**: equal-frequency (quantile) bins, Sturges/Doane/Rice/Scott rules, log-scale bins.
- **Inference & comparison**: weighted confidence intervals & t-tests, two-sample `compare`,
  weighted correlation.
- **Grouping extras**: `CUBE` / arbitrary grouping-sets beyond prefix `ROLLUP`.
- **Adapters**: `@distribu-tron/vega` and friends: plot-ready arrays → chart specs.

## Notice

This package includes the `ticks`, `tickIncrement`, and `nice` functions ported from
[d3-array](https://github.com/d3/d3-array) © Mike Bostock, distributed under the ISC License.
See [LICENSE](./LICENSE) for the full text.

## License

[MIT](./LICENSE) © Daniel Marsh-Patrick
