# Utilities

```ts
import { summary, time } from "distribu-tron";
```

## `summary(d)`

Compute the full single-distribution summary in one call — the single-`Distribution` counterpart to
[`summarize`](./grouping#summarize-grouped-levels). Returns `SummaryStatistics`.

**Parameters** — `d: Distribution`.

**`SummaryStatistics`**

```ts
interface SummaryStatistics {
  n: number; // total weight (Σ weight)
  size: number; // count of distinct values
  mean: number;
  stdev: number; // population standard deviation
  min: number;
  max: number;
  range: number;
  mode: number;
  mad: number;
  skewness: number;
  kurtosis: number; // excess kurtosis (normal ⇒ 0)
  q1: number;
  median: number; // = q2 (interpolated)
  q3: number;
  iqr: number;
}
```

Each field is computed by the corresponding free function: `n`/`size`/`min`/`max` come straight from
the [`Distribution`](./distribution#the-distribution-object); `mean`, `stdev`, `range`, `mode`, `mad`,
`skewness`, `kurtosis` from [descriptives](./descriptives); and `q1`/`median`/`q3`/`iqr` from
[`quartiles`](./quantiles-boxplot#quartiles-d) (so `median` is the interpolated `q2`). `stdev` is the
**population** standard deviation; `kurtosis` is **excess** kurtosis.

**Returns** `SummaryStatistics` — see above.

**Degenerate input** — for an empty or zero-mass distribution every scalar follows the uniform
contract: `mean`, `stdev`, `range`, `mode`, `mad`, `skewness`, `kurtosis`, `q1`, `median`, `q3`,
`iqr` are `NaN`, `min` is `+Infinity`, `max` is `−Infinity`, and `n`/`size` are `0`.

## `time(fn)`

A tiny wall-clock timing helper: invoke `fn`, returning both its result and how long it took (in
milliseconds, via `performance.now()`). Returns `{ value, ms }`.

```ts
function time<T>(fn: () => T): { value: T; ms: number };
```

**Parameters**

- `fn: () => T` — a zero-argument function to invoke and time.

**Returns** `{ value: T; ms: number }` — `value` is whatever `fn` returned; `ms` is the elapsed
wall-clock time in milliseconds.

```ts
import { distribution, time } from "distribu-tron";

const { value: d, ms } = time(() => distribution(rows));
console.log(`prepared ${d.size} distinct values in ${ms.toFixed(2)}ms`);
```

**Degenerate input** — `time` does not interact with `Distribution` and has no special degenerate behavior; any exception thrown by `fn` propagates normally (standard JS behavior).

::: tip
`time` does not catch errors or run `fn` more than once — it is a convenience wrapper around a single
`performance.now()` pair, not a benchmark harness. For preparation-phase breakdowns, use
`distribution(input, { profile: true })` and read [`Distribution.timings`](./distribution#preptimings).
:::
