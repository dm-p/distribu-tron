# API Reference

`distribu-tron` is ESM-only and tree-shakeable. Every export is reachable from the package root:

```ts
import { distribution, mean, quantile, histogram, group } from "distribu-tron";
```

The library follows a **prepared-substrate** model: build a `Distribution` once with
[`distribution()`](./distribution), then read it many times with the free functions below. None of
the read functions re-sort or re-aggregate.

This reference mirrors `src/index.ts` exactly. Types are exported via `export type *` from
[`types.ts`](#types) and are documented inline on the page where they are used.

## Distribution

The factory that normalizes any supported input into the immutable, sorted, distinct substrate that
every other function reads.

- [`distribution(input, options?)`](./distribution#distribution-input-options)

## Descriptives

Single-number summaries computed directly from the weighted substrate.

- [`mean(d)`](./descriptives#mean-d)
- [`sum(d)`](./descriptives#sum-d)
- [`min(d)`](./descriptives#min-d)
- [`max(d)`](./descriptives#max-d)
- [`range(d)`](./descriptives#range-d)
- [`variance(d, options?)`](./descriptives#variance-d-options)
- [`stdev(d, options?)`](./descriptives#stdev-d-options)
- [`mode(d)`](./descriptives#mode-d)
- [`mad(d)`](./descriptives#mad-d)
- [`skewness(d)`](./descriptives#skewness-d)
- [`kurtosis(d)`](./descriptives#kurtosis-d)

## Quantiles and box plot

Weighted quantiles (type-7 by default) and the five-number box-plot summary.

- [`quantile(d, p, options?)`](./quantiles-boxplot#quantile-d-p-options)
- [`median(d)`](./quantiles-boxplot#median-d)
- [`quartiles(d)`](./quantiles-boxplot#quartiles-d)
- [`percentileRank(d, value)`](./quantiles-boxplot#percentilerank-d-value)
- [`boxplot(d, options?)`](./quantiles-boxplot#boxplot-d-options)

## Histogram, KDE, ECDF

Plot-ready shape and density series, all derived from the same substrate.

- [`histogram(d, options?)`](./histogram-kde-ecdf#histogram-d-options)
- [`DEFAULT_MAX_AUTO_BINS`](./histogram-kde-ecdf#default-max-auto-bins)
- [`kde(d, options?)`](./histogram-kde-ecdf#kde-d-options)
- [`silvermanBandwidth(n, iqr, sd)`](./histogram-kde-ecdf#silvermanbandwidth-n-iqr-sd)
- [`scottBandwidth(n, sd)`](./histogram-kde-ecdf#scottbandwidth-n-sd)
- [`ecdf(d)`](./histogram-kde-ecdf#ecdf-d)
- [`cdf(d, value)`](./histogram-kde-ecdf#cdf-d-value)

## Grouping

Bucket rows into one `Distribution` per key (with optional ROLLUP subtotals), then summarize or
overlay comparable histograms / KDE curves across the groups.

- [`group(rows, spec)`](./grouping#group-rows-spec)
- [`summarize(grouped, levels?)`](./grouping#summarize-grouped-levels)
- [`groupedHistogram(grouped, options?)`](./grouping#groupedhistogram-grouped-options)
- [`groupedKde(grouped, options?)`](./grouping#groupedkde-grouped-options)

## Utilities

- [`summary(d)`](./utilities#summary-d) — the single-distribution counterpart to `summarize`.
- [`time(fn)`](./utilities#time-fn) — a tiny wall-clock timing helper.

## Types

All public types are re-exported from the package root (`export type * from "./types"`):

`WeightedValue`, `DistributionInput`, `DistributionOptions`, `PrepTimings`, `Distribution`,
`QuantileMethod`, `SummaryStatistics`, `Bin`, `KdePoint`, `EcdfPoint`, `BoxplotResult`,
`HistogramOptions`, `KdeOptions`, `KdeKernel`, `GroupKeyValue`, `Accessor`, `GroupSpec`, `DistributionGroup`,
`GroupedDistribution`, `LevelSelect`.

Each type is documented inline on the page where the relevant function lives.
