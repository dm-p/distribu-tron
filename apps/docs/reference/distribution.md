# Distribution

The factory and the prepared substrate every other function reads.

```ts
import { distribution } from "distribu-tron";
```

## `distribution(input, options?)`

Normalize any supported input into an immutable, **sorted, distinct** `Distribution`: a
`Float64Array` substrate of values, their aggregated weights, and an inclusive running cumulative
weight. Returns `Distribution`.

By default the factory validates every pair, aggregates duplicate values (summing their weights),
and sorts ascending. Pass `{ sorted: true }` to skip aggregation and sorting when the caller already
guarantees ascending, distinct input.

**Parameters**

- `input: DistributionInput` — the data, in one of three forms (see below).
- `options?: DistributionOptions` — `sorted` and `profile` flags (see below).

**Returns** `Distribution` — the prepared substrate.

**Degenerate input** — an empty input produces a `Distribution` with `size: 0`, `n: 0`,
`min: +Infinity`, `max: -Infinity`, and empty typed arrays. Reading functions then follow the
uniform degenerate contract (scalars `NaN`, arrays `[]`).

**Throws** `RangeError` when:

- a value is non-finite (`NaN`, `±Infinity`);
- a weight is negative or non-finite;
- columnar `values` and `weights` differ in length.

Zero weights are permitted — they contribute a flat step to `cumulative`.

### `DistributionInput`

```ts
type DistributionInput =
  | WeightedValue[]
  | number[]
  | { values: ArrayLike<number>; weights?: ArrayLike<number> };
```

Three accepted forms:

1. **`WeightedValue[]`** — an array of `{ value, weight }` rows. This is the canonical frequency-table
   form.
2. **`number[]`** — a plain numeric sample; each element is taken at `weight: 1`.
3. **Columnar `{ values, weights? }`** — parallel `ArrayLike<number>` columns (e.g. typed arrays from
   a SQL/columnar source). `weights` is optional; when omitted every value gets `weight: 1`. When
   present, `values` and `weights` must be the same length (otherwise `RangeError`).

```ts
interface WeightedValue {
  value: number;
  weight: number; // fractional weights allowed; must be finite and ≥ 0
}
```

The field is `weight`, never `count` — fractional weights are allowed, and `n` is Σ weight, not a
row count.

### `DistributionOptions`

```ts
interface DistributionOptions {
  sorted?: boolean;
  profile?: boolean;
}
```

- **`sorted`** (default `false`) — a trust-the-caller fast path. When `true`, the factory skips both
  aggregation and sorting and materializes the substrate directly from the input order. It does
  **not** validate ascending/distinct order — passing unsorted or duplicate data with this flag
  yields an undefined (incorrect) substrate, by design. Intended for already-ordered output such as
  SQL `GROUP BY value ORDER BY value`. Values and weights are still range-validated.
- **`profile`** (default `false`) — when `true`, attaches a `timings: PrepTimings` field to the
  result recording how long each preparation phase took.

### The `Distribution` object

```ts
interface Distribution {
  readonly size: number; // count of DISTINCT values
  readonly n: number; // total weight = Σ weight
  readonly min: number; // smallest value (+Infinity if empty)
  readonly max: number; // largest value (−Infinity if empty)
  readonly values: Float64Array; // ascending, distinct
  readonly weights: Float64Array; // aggregated weight per value
  readonly cumulative: Float64Array; // inclusive running Σ weight; cumulative[i] = Σ_{j≤i} weights[j]
  readonly timings?: PrepTimings; // present only when prepared with { profile: true }
}
```

- **`size`** is the number of distinct values, **not** the total weight.
- **`n`** is the total weight (Σ weight). It equals the row count only for unit-weight input.
- **`cumulative[i]`** is the inclusive running weight up to and including index `i`; the last entry
  equals `n`. Quantile functions binary-search this array.

### `PrepTimings`

```ts
interface PrepTimings {
  validateMs: number; // time spent reading + validating input pairs
  aggregateMs: number; // time spent aggregating duplicates (0 on the sorted fast path)
  sortMs: number; // time spent sorting distinct keys (0 on the sorted fast path)
  totalMs: number; // total preparation wall-clock time
}
```

Present on the returned `Distribution` only when prepared with `{ profile: true }`. On the
`{ sorted: true }` fast path, `aggregateMs` and `sortMs` are both `0`.
