# distribu-tron

**Fast, weighted, plot-ready distribution statistics from a frequency table.**

Hand it a frequency table — the output of a database/engine `GROUP BY` (Power BI DAX, SQL,
DuckDB), or just raw values — and get back plot-ready descriptives, quantiles, box plots,
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

## Why this exists

Almost every JS stats library assumes **raw, unit-weight samples**. But real analytical data
is already aggregated — a `GROUP BY value` gives you `{ value, count }` rows, not a flat array.
Re-exploding a frequency table back into millions of raw values just to compute a median is
wasteful and often impossible.

`distribu-tron` is the maintained JS library that computes a **full stats pipeline directly on
weighted / pre-aggregated input**. Python has this (`statsmodels.DescrStatsW`, weighted
`numpy`/`scipy`); JavaScript did not. It's sold as the pipeline — descriptives, quantiles,
density, grouping — not "a KDE library." The core emits plain plot-ready arrays and never
imports a charting grammar; chart adapters are separate, optional packages on the roadmap.

## Install

```sh
pnpm add distribu-tron   # or: npm i distribu-tron / yarn add distribu-tron
```

Requires Node ≥ 22. ESM-only (`import`, no `require`).

## The model

`distribution()` normalizes any supported input into a prepared, immutable `Distribution`
(sorted, distinct, `Float64Array` substrate + cumulative weights). You build it **once** and
read it **many** times with tree-shakeable free functions.

```ts
// All three inputs produce an equivalent Distribution:
distribution([{ value: 5, weight: 3 }, { value: 9, weight: 1 }]); // frequency table
distribution([5, 5, 5, 9]);                                        // raw values (auto-aggregated, weight 1 each)
distribution({ values: [5, 9], weights: [3, 1] });                 // columnar / TypedArray

// Already sorted & distinct (e.g. straight from SQL `GROUP BY value ORDER BY value`)?
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

- **Descriptives** — weighted mean/sum/variance/stdev (population by default, `{ sample: true }`
  for n−1), mode, median absolute deviation, skewness, excess kurtosis. Numerically stable
  (Neumaier compensated summation) so results hold at very large `n` where naive accumulation drifts.
- **Quantiles** — weighted `quantile(d, p, { method })` (type-7 `linear` default, plus
  `lower`/`higher`/`nearest`/`midpoint`), `median`, `quartiles`, `percentileRank`, and `boxplot`
  with 1.5·IQR fences + outliers.
- **Shape & density** — `ecdf`/`cdf`, a capped Freedman–Diaconis `histogram` (weights conserved;
  explicit `edges` supported), and a windowed Epanechnikov `kde` with Silverman bandwidth.

### Grouping with ROLLUP

`group()` turns a row set into one `Distribution` per key, with optional hierarchical subtotals
and a grand total — like SQL `GROUP BY ... WITH ROLLUP`. The grouped plot helpers share one
domain (identical histogram edges / KDE sample points) across every series, so they overlay cleanly.

```ts
import { group, summarize, groupedHistogram } from "distribu-tron";

const rows = [
  { category: "Bikes",       series: "2024", value: 20, weight: 1200 },
  { category: "Bikes",       series: "2025", value: 24, weight: 145  },
  { category: "Accessories", series: "2024", value: 10, weight: 1203 },
  { category: "Accessories", series: "2025", value: 10, weight: 540  },
];

const gd = group(rows, {
  by: ["category", "series"],
  value: "value",
  weight: "weight",
  rollup: true,
  totalLabel: "(All)",
});

summarize(gd);                              // one stats row per leaf + subtotal + grand total, tagged with level/depth
groupedHistogram(gd);                       // leaves only, shared bin edges — ready to stack/overlay
groupedHistogram(gd, { includeOverall: true }); // add the grand-total series
```

Each group is tagged with its `key`, plus `level`/`depth` so you can tell a `"(All)"` subtotal
apart from a leaf whose value happens to equal the total label.

> **Reserved field names:** grouped helpers flatten the group key onto each output row, so don't
> name a grouping dimension after an output field (`weight`, `x`, `density`, `n`, `min`, `max`,
> `median`, `depth`) — the key would overwrite it.

## Empty & malformed input

- An **empty** distribution is valid: scalar functions return `NaN` (`min` `+Infinity`, `max`
  `−Infinity`), array functions return `[]`. No throws.
- Malformed input fails fast: negative/`NaN` weights, non-finite values, mismatched columnar
  lengths, and `p ∉ [0, 1]` throw `RangeError`.

## Performance

Indicative `vitest bench` results, N = 100,000 distinct values, Node 24 (single machine — your
numbers will vary, but the shape holds). The library's premise is that you prepare a
`Distribution` once and query it repeatedly, so "prepared" is the steady-state cost.

| Benchmark | distribu-tron (prepared) | Baseline | Speedup |
|---|--:|--:|--:|
| `quantile(d, 0.5)` | ~20.1M ops/s | d3-array `quantileSorted` ~19.7M ops/s | **1.02×** |
| `quantile(d, 0.5)` | ~20.1M ops/s | simple-statistics `quantile` ~3.6K ops/s | **~5,500×** |
| `histogram(d)` | ~66.6K ops/s | d3-array `bin` ~660 ops/s | **~100×** |

Building the `Distribution` from raw values (`distribution(raw)` + one quantile) runs ~420 ops/s
at this N — that one-time prep is what every subsequent query amortizes away. Reproduce with
`pnpm bench`.

## Roadmap

v1 is the API above. Later phases slot into reserved option slots without breaking signatures:

- **Density** — more kernels (Gaussian, triangular, cosine) and bandwidth selectors.
- **Binning** — equal-frequency (quantile) bins, Sturges/Doane/Rice/Scott rules, log-scale bins.
- **Inference & comparison** — weighted confidence intervals & t-tests, two-sample `compare`,
  weighted correlation.
- **Grouping extras** — `CUBE` / arbitrary grouping-sets beyond prefix `ROLLUP`.
- **Adapters** — `@distribu-tron/vega` and friends: plot-ready arrays → chart specs.

## Notice

This package includes the `ticks`, `tickIncrement`, and `nice` functions ported from
[d3-array](https://github.com/d3/d3-array) © Mike Bostock, distributed under the ISC License.
See [LICENSE](./LICENSE) for the full text.

## License

[MIT](./LICENSE) © Daniel Marsh-Patrick
