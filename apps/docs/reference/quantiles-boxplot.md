# Quantiles and box plot

Weighted quantiles (type-7 by default) and the five-number box-plot summary, all read from the
prepared [`Distribution`](./distribution#the-distribution-object).

```ts
import { quantile, median, quartiles, percentileRank, boxplot } from "distribu-tron";
```

## `quantile(d, p, options?)`

Weighted quantile at probability `p ∈ [0, 1]`. Returns `number`. Reduces to the standard type-7
quantile for unit weights; the rank `p · (n − 1)` interpolates over the total weight `n` as the
effective sample size.

**Parameters**

- `d: Distribution`.
- `p: number` — probability in `[0, 1]`.
- `options?: { method?: QuantileMethod }` — the interpolation/selection rule; defaults to
  `"linear"`.

**`QuantileMethod`**

```ts
type QuantileMethod = "linear" | "lower" | "higher" | "nearest" | "midpoint";
```

For the (0-indexed, expanded) rank `h = p · (n − 1)`:

- **`"linear"`** (default) — linear interpolation between the order statistics straddling `h`
  (type-7).
- **`"lower"`** — the order statistic at `floor(h)`.
- **`"higher"`** — the order statistic at `ceil(h)`.
- **`"nearest"`** — the order statistic at `round(h)` (rounds half away from zero).
- **`"midpoint"`** — the average of the `floor(h)` and `ceil(h)` order statistics.

**Returns** `number` — the quantile value.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution; returns the single
value when `size === 1`.

**Throws** `RangeError` when `p` is outside `[0, 1]` (this also rejects `NaN`).

::: warning Probability/importance weights
Weights are treated as **frequencies**. Weights that sum to ≈ 1 are degenerate: `n − 1 ≈ 0`, so
every quantile collapses to the smallest value. Scale such weights to a count-like magnitude first,
or use the scale-invariant [`percentileRank`](#percentilerank-d-value) /
[`cdf`](./histogram-kde-ecdf#cdf-d-value).
:::

## `median(d)`

The interpolated median — shorthand for `quantile(d, 0.5)` (type-7 linear). Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — the median.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution.

::: tip
This is the interpolated median. [`mad`](./descriptives#mad-d) and the internal step-median use a
different (order-statistic) definition.
:::

## `quartiles(d)`

The three quartiles plus the interquartile range, each via type-7 `quantile`. Returns
`{ q1, q2, q3, iqr }`.

**Parameters** — `d: Distribution`.

**Returns** `{ q1: number; q2: number; q3: number; iqr: number }` where:

- `q1` = `quantile(d, 0.25)`,
- `q2` = `quantile(d, 0.5)` — **the median is `q2`**,
- `q3` = `quantile(d, 0.75)`,
- `iqr` = `q3 − q1`.

**Degenerate input** — every field is `NaN` for an empty or zero-mass distribution.

## `percentileRank(d, value)`

`P(X ≤ value)`: the cumulative weight of all values ≤ `value`, divided by `n`. Returns `number` in
`[0, 1]`. Scale-invariant in the weights.

**Parameters**

- `d: Distribution`.
- `value: number` — the threshold (need not be a value present in the distribution).

**Returns** `number` — the fraction of total weight at or below `value`.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution.

## `boxplot(d, options?)`

The Tukey box-plot summary: five-number summary, Tukey fences, whisker (adjacent) ends, and
outliers. Returns `BoxplotResult`.

**Parameters**

- `d: Distribution`.
- `options?: { whisker?: number }` — the fence multiplier `k`; **defaults to `1.5`**. Fences are
  `q1 − k·iqr` and `q3 + k·iqr`.

**`BoxplotResult`**

```ts
interface BoxplotResult {
  min: number; // d.min
  q1: number;
  median: number; // = q2 from quartiles()
  q3: number;
  max: number; // d.max
  iqr: number;
  lowerFence: number; // q1 − k·iqr
  upperFence: number; // q3 + k·iqr
  lowerAdjacent: number; // lowest value ≥ lowerFence — lower whisker end (NaN if empty)
  upperAdjacent: number; // highest value ≤ upperFence — upper whisker end (NaN if empty)
  outliers: number[]; // values outside the fences (ascending)
}
```

**Returns** `BoxplotResult` — see fields above. `median` is the interpolated quartile `q2`. The
adjacent (whisker-end) values and `outliers` are computed from the actual observations; **zero-weight
values are ignored** (they carry no mass, so they are neither whisker ends nor outliers).

**Degenerate input** — for an empty or zero-mass distribution the quartile fields are `NaN`,
`lowerAdjacent`/`upperAdjacent` are `NaN`, and `outliers` is `[]`.
