# Descriptives

Single-number summaries. Each takes a prepared [`Distribution`](./distribution#the-distribution-object) and
reads the weighted substrate directly — `n` is the total weight (Σ weight), not a row count.

```ts
import {
  mean, sum, min, max, range,
  variance, stdev, mode, mad, skewness, kurtosis,
} from "distribu-tron";
```

All moment-based statistics (`mean`, `variance`, `stdev`, `skewness`, `kurtosis`) accumulate with
**Neumaier compensated summation** for numerical stability at large `n`.

**Degenerate input (uniform contract).** For an empty (`size === 0`) or zero-mass (`n <= 0`)
distribution, every scalar here returns **`NaN`** (and on the `Distribution` itself, `min` is
`+Infinity`, `max` is `−Infinity`).

## `sum(d)`

Weighted sum Σ (value · weight). Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — Σ over all distinct values of `value · weight`.

**Degenerate input** — returns `0` for an empty distribution (empty sum); not `NaN`.

## `mean(d)`

Weighted arithmetic mean, `sum(d) / n`. Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — the weighted mean.

**Degenerate input** — returns `NaN` when `n <= 0`.

## `min(d)`

Smallest value. Returns `number` — equal to `d.min`.

**Parameters** — `d: Distribution`.

**Returns** `number` — `d.min`.

**Degenerate input** — `+Infinity` (the value of `d.min` for an empty distribution).

## `max(d)`

Largest value. Returns `number` — equal to `d.max`.

**Parameters** — `d: Distribution`.

**Returns** `number` — `d.max`.

**Degenerate input** — `−Infinity` (the value of `d.max` for an empty distribution).

## `range(d)`

Spread `max − min`. Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — `d.max - d.min`.

**Degenerate input** — returns `NaN` when `size === 0`.

## `variance(d, options?)`

Weighted variance — **population** by default. Returns `number`.

**Parameters**

- `d: Distribution`.
- `options?: { sample?: boolean }` — when `sample: true`, applies Bessel's correction (divides by
  `n − 1` instead of `n`), giving the sample variance.

**Returns** `number` — the variance. Clamped to `0` if the computed value is non-positive or
non-finite.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution, and also for the
sample form when `n − 1 <= 0` (i.e. effective `n <= 1`).

## `stdev(d, options?)`

Weighted standard deviation — `Math.sqrt(variance(d, options))`. Returns `number`.

**Parameters**

- `d: Distribution`.
- `options?: { sample?: boolean }` — same `sample` flag as `variance`; population by default.

**Returns** `number` — the standard deviation.

**Degenerate input** — returns `NaN` wherever `variance` does (empty / zero-mass, or sample form
with effective `n <= 1`).

## `mode(d)`

The value carrying the most weight. Returns `number`. On ties, the **smallest** such value wins.

**Parameters** — `d: Distribution`.

**Returns** `number` — the modal value.

**Degenerate input** — returns `NaN` when `size === 0`.

## `mad(d)`

Weighted median absolute deviation: the weighted (step/order-statistic) lower median of
`|value − median|`, where `median` is the weighted lower median of the distribution. Returns
`number`.

::: tip
`mad` uses the **step median** (first value whose inclusive cumulative weight reaches `n/2`), not the
interpolated [`quantile(d, 0.5)`](./quantiles-boxplot#median-d). It is scale-invariant in the weights
(normalized by `n`).
:::

**Parameters** — `d: Distribution`.

**Returns** `number` — the median absolute deviation.

**Degenerate input** — returns `NaN` when `size === 0`.

## `skewness(d)`

Weighted skewness (third standardized moment): `m3 / m2^1.5`, using population central moments.
Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — the skewness; `0` when the variance `m2` is not positive.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution.

## `kurtosis(d)`

Weighted **excess** kurtosis (fourth standardized moment minus 3): `m4 / m2² − 3`, so a normal
distribution gives `0`. Returns `number`.

**Parameters** — `d: Distribution`.

**Returns** `number` — the excess kurtosis; `0` when the variance `m2` is not positive.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution.
