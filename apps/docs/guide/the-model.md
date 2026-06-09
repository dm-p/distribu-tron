# The prepared-substrate model

The whole library is organized around one idea: **prepare once, read many times.**

## `distribution()` normalizes the input

`distribution()` accepts any of three input shapes and normalizes them into a single immutable
`Distribution`:

```ts
import { distribution } from "distribu-tron";

// All three inputs produce an equivalent Distribution:
distribution([
  { value: 5, weight: 3 },
  { value: 9, weight: 1 },
]);                                                 // WeightedValue[] — frequency table
distribution([5, 5, 5, 9]);                         // number[] — raw values (each weight 1)
distribution({ values: [5, 9], weights: [3, 1] });  // columnar / TypedArray
```

Internally it **validates**, **deduplicates**, and **sorts** the input into a sorted, *distinct*
`Float64Array` substrate. Malformed input throws a `RangeError` (a non-finite value, a
negative or non-finite weight, or mismatched columnar lengths).

## The `Distribution` shape

The result is an immutable (`readonly`) object backed by parallel `Float64Array`s plus a few scalars:

```ts
interface Distribution {
  readonly size: number;        // count of DISTINCT values
  readonly n: number;           // total weight = Σ weight (NOT a row count)
  readonly min: number;
  readonly max: number;
  readonly values: Float64Array;     // sorted, distinct
  readonly weights: Float64Array;    // weight per distinct value
  readonly cumulative: Float64Array; // inclusive running Σ weight; cumulative[i] = Σ_{j≤i} weights[j]
  readonly timings?: PrepTimings;    // present only when built with { profile: true }
}
```

Two fields are easy to misread:

- **`size`** is the number of *distinct* values, not the number of observations.
- **`n`** is the *total weight* (Σ weight), not a row count. With fractional weights it is not even an
  integer.

## Free functions read the substrate

Every reader function takes a `Distribution` and computes its result by **binary search over
`cumulative`** (for weighted quantile rank) or by **scanning `values` / `weights`** (for moments and
histograms). They never re-sort or re-aggregate — that work was done once, up front. This is why
building the distribution once and reading many statistics off it is the efficient path.

## The `{ sorted: true }` fast path

If your data already arrives sorted and distinct — for example straight from SQL
`GROUP BY value ORDER BY value` — you can skip the internal aggregate-and-sort step:

```ts
distribution(rows, { sorted: true });
```

This is a **trust-the-caller** fast path. It does not validate ascending or distinct order — by
design. Pass it only data you know is already sorted and deduplicated; otherwise let
`distribution()` do the work.
