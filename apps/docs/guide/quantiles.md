# Quantiles and box plots

Quantiles are computed by binary search over the distribution's inclusive cumulative-weight array —
the weighted analogue of a rank lookup — so they read directly off the prepared substrate.

```ts
import {
  distribution,
  quantile, median, quartiles, percentileRank, boxplot,
} from "distribu-tron";

const d = distribution([
  { value: 0, weight: 8 }, { value: 4, weight: 19 }, { value: 8, weight: 34 },
  { value: 12, weight: 49 }, { value: 16, weight: 58 }, { value: 20, weight: 52 },
  { value: 24, weight: 40 }, { value: 28, weight: 27 }, { value: 32, weight: 16 },
  { value: 36, weight: 8 }, { value: 40, weight: 4 },
]);
```

## `quantile`

```ts
quantile(d, 0.5);                      // weighted median, "linear" (type-7) by default
quantile(d, 0.9, { method: "nearest" });
```

The `method` option selects how a quantile that falls *between* two distinct values is resolved.
There are five `QuantileMethod`s:

| Method      | Behavior at a fractional rank                                  |
| ----------- | ------------------------------------------------------------- |
| `"linear"`  | Linear interpolation between the bracketing values (default). |
| `"lower"`   | The value at or below the rank.                               |
| `"higher"`  | The value at or above the rank.                               |
| `"nearest"` | The nearer of the two bracketing values.                     |
| `"midpoint"`| The arithmetic midpoint of the two bracketing values.        |

`p` must lie in `[0, 1]`. A `p` outside that range — including `NaN` — throws a `RangeError`.

## `median`, `quartiles`, `percentileRank`

```ts
median(d);        // === quantile(d, 0.5)

quartiles(d);     // → { q1, q2, q3, iqr }  (q2 is the median; iqr = q3 − q1)

percentileRank(d, 18); // the weighted fraction of mass at or below 18, in [0, 1]
```

Note that `quartiles` returns the median as the **`q2`** field (not `median`), and includes the
interquartile range `iqr` directly.

## `boxplot`

`boxplot` returns a Tukey box plot with fences, whisker-adjacent values, and outliers:

```ts
const b = boxplot(d);
// optional custom whisker multiplier (default 1.5):
boxplot(d, { whisker: 3 });
```

The `BoxplotResult` shape:

| Field           | Meaning                                                            |
| --------------- | ----------------------------------------------------------------- |
| `min`           | Smallest value in the distribution.                               |
| `q1`            | First quartile.                                                   |
| `median`        | Median (q2).                                                      |
| `q3`            | Third quartile.                                                   |
| `max`           | Largest value.                                                    |
| `iqr`           | Interquartile range, `q3 − q1`.                                   |
| `lowerFence`    | `q1 − whisker × iqr`.                                             |
| `upperFence`    | `q3 + whisker × iqr`.                                             |
| `lowerAdjacent` | Lowest value at or above `lowerFence` — the lower whisker end.    |
| `upperAdjacent` | Highest value at or below `upperFence` — the upper whisker end.   |
| `outliers`      | Values beyond the fences, as a `number[]`.                        |

> A box plot is a derived *statistic*, not a chart kind — it has no `<IoFigure>` renderer. Read the
> fields above and feed them into your own box-and-whisker chart.

## Degenerate input

An empty distribution, or one with zero total mass (`n ≤ 0`), has no defined quantiles. In that case
`quantile`, `median`, `quartiles` (every field), and `percentileRank` return **`NaN`**, and every
scalar field of `boxplot` is `NaN` with `outliers: []` — the same uniform contract as the
[descriptives](./descriptives). A probability `p` outside `[0, 1]` (including `NaN`) throws a
`RangeError`.
