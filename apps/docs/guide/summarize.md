# Summarize

`summarize()` turns a `GroupedDistribution` into a flat table of per-group summary statistics — one
tagged row per selected level. It is the table-shaped counterpart to the grouped plot consumers.

```ts
import { group, summarize } from "distribu-tron";

const grouped = group(rows, { by: "region", value: "score", weight: "count", rollup: true });

const table = summarize(grouped);
// → Array of rows, each = the group's key fields + `depth` + every SummaryStatistics field
```

## Output rows

Each row is a `SummaryStatistics` object **flattened with the group's key fields and `depth`**. The
statistics:

```ts
interface SummaryStatistics {
  n: number;       // total weight = Σ weight
  size: number;    // count of distinct values
  mean: number;
  stdev: number;
  min: number;
  max: number;
  range: number;
  mode: number;
  mad: number;
  skewness: number;
  kurtosis: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
}
```

A small grouped result, by `region`, with rollup:

| region | depth |   n | mean | median | q1 | q3 | iqr | stdev |
| ------ | ----: | --: | ---: | -----: | -: | -: | --: | ----: |
| east   |     1 | 120 | 17.4 |     16 | 12 | 24 |  12 |   8.1 |
| west   |     1 |  95 | 19.1 |     20 | 12 | 24 |  12 |   8.6 |
| *(total)* | 0 | 215 | 18.1 |    16 | 12 | 24 |  12 |   8.3 |

The total row is the grand total (`depth === 0`); its rolled-up `region` key carries the
`totalLabel` (`null` by default).

## Selecting levels with `LevelSelect`

Unlike the grouped plot consumers — which emit leaves only by default — tables usually want every
level, so `summarize` **defaults to including both subtotals and the grand total**. Suppress either
with `LevelSelect`:

```ts
summarize(grouped);                                  // leaves + subtotals + grand total
summarize(grouped, { includeSubtotals: false });     // drop intermediate rollup levels
summarize(grouped, { includeOverall: false });       // drop the grand total
summarize(grouped, { includeSubtotals: false, includeOverall: false }); // leaves only
```

With no `rollup` on the original `group()` call, those extra levels don't exist, so `summarize`
returns just the leaf rows regardless of `LevelSelect`.
