# Grouping

Bucket rows into one [`Distribution`](./distribution#the-distribution-object) per key — with optional
prefix-ROLLUP subtotals and a grand total — then summarize them or overlay comparable histograms /
KDE curves across the groups.

```ts
import { group, summarize, groupedHistogram, groupedKde } from "distribu-tron";
```

## `group(rows, spec)`

Bucket plain object rows into per-key distributions. Returns a `GroupedDistribution` carrying the
leaf groups, the `overall` distribution, and (with `rollup: true`) prefix-ROLLUP subtotals plus a
grand total. Returns `GroupedDistribution`.

**Parameters**

- `rows: ReadonlyArray<Record<string, unknown>>` — the input rows.
- `spec: GroupSpec` — how to bucket, read values/weights, and roll up (see below).

**`Accessor`**

```ts
type Accessor<T> = string | ((row: Record<string, unknown>) => T);
```

A column name (string) or a function that extracts the value from a row.

**`GroupSpec`**

```ts
interface GroupSpec {
  by: string | string[]; // grouping dimension(s), in prefix order for rollup
  value: Accessor<number>; // how to read each row's value
  weight?: Accessor<number>; // how to read each row's weight (default: 1 per row)
  rollup?: boolean; // emit prefix-ROLLUP subtotals + grand total (default false)
  totalLabel?: string | null; // label for rolled-up dimensions (default null)
  sorted?: boolean; // per-leaf fast path (see note)
}
```

- **`by`** — one or more dimension column names. The order matters for `rollup` (prefix subtotals).
- **`value`** / **`weight`** — accessors; `weight` defaults to `1` per row when omitted.
- **`rollup`** (default `false`) — when `true`, also emit prefix subtotals (for depths
  `dims−1 … 1`) and a grand total at depth `0`.
- **`totalLabel`** (default `null`) — the key value placed on rolled-up dimensions. Consumers
  filtering by key equality must handle `null`, or pass an explicit label like `"(All)"`.
- **`sorted`** — passed through to the per-leaf `distribution()` fast path only. It applies **only**
  to individual leaf groups (whose rows may arrive value-sorted). The `overall` distribution and all
  rollup subtotals concatenate across groups, so they always re-sort/aggregate regardless of this
  flag.

**`GroupKeyValue`**

```ts
type GroupKeyValue = string | number | null;
```

**`DistributionGroup`**

```ts
interface DistributionGroup {
  readonly key: Record<string, GroupKeyValue>; // dimension → value (totalLabel on rolled-up dims)
  readonly level: string[]; // dimensions active (not rolled up)
  readonly depth: number; // level.length
  readonly distribution: Distribution;
}
```

**`GroupedDistribution`**

```ts
interface GroupedDistribution {
  readonly dimensions: string[]; // resolved grouping dimensions
  readonly groups: DistributionGroup[]; // leaves + (if rollup) subtotals + grand total
  readonly leaves: DistributionGroup[]; // leaf groups only (full-depth keys)
  readonly overall: Distribution; // all rows merged (the grand-total distribution)
}
```

Without `rollup`, `groups` equals `leaves`. With `rollup`, `groups` is
`[...leaves, ...subtotals, grandTotal]`, where the grand total has `level: []`, `depth: 0`, and
`distribution === overall`.

**Returns** `GroupedDistribution` — see above.

**Degenerate input** — with no rows, `leaves` is `[]` and `overall` is an empty distribution.

## `summarize(grouped, levels?)`

Per-group summary statistics — one tagged [`SummaryStatistics`](./utilities#summary-d) row per
selected level. Returns `(SummaryStatistics & key & { depth })[]`.

Unlike `groupedHistogram` / `groupedKde`, this **defaults to including** subtotals and the grand
total (tables usually want every level). With no `rollup`, those levels don't exist, so the result
is just the leaves.

**Parameters**

- `grouped: GroupedDistribution`.
- `levels?: LevelSelect` — which rollup levels to emit (see below). Defaults to including both
  subtotals and the overall total.

**`LevelSelect`**

```ts
interface LevelSelect {
  includeSubtotals?: boolean; // intermediate prefix subtotals
  includeOverall?: boolean; // the grand total (depth 0)
}
```

For `summarize`, both default to `true` (pass `{ includeSubtotals: false }` /
`{ includeOverall: false }` to suppress). For `groupedHistogram` / `groupedKde`, both default to
`false` (leaves only).

**Returns** an array of `SummaryStatistics` rows, each flattened with the group's key fields and
`depth`.

**Reserved-field guard** — the group key is spread onto each output row, so a grouping dimension
whose name collides with an output field (here: `n`, `size`, `mean`, `stdev`, `min`, `max`, `range`,
`mode`, `mad`, `skewness`, `kurtosis`, `q1`, `median`, `q3`, `iqr`, or `depth`) throws a
`RangeError` instead of silently overwriting the statistic. Rename the dimension.

**Degenerate input** — each group delegates to `summary()`, so an empty or zero-mass group produces a `SummaryStatistics` row where all scalar fields follow the uniform contract (`NaN` for moments, `+Infinity`/`−Infinity` for `min`/`max`, `0` for `n`/`size`).

## `groupedHistogram(grouped, options?)`

One histogram per selected group, all sharing **identical bin edges** derived from the `overall`
distribution — so the series are directly comparable / stackable. Returns
`(Bin & key & { depth })[]`. Leaves only by default.

**Parameters**

- `grouped: GroupedDistribution`.
- `options?: HistogramOptions & LevelSelect` — the same [`HistogramOptions`](./histogram-kde-ecdf#histogram-d-options)
  as `histogram` (used to derive the shared edges from `overall`), plus
  [`LevelSelect`](#summarize-grouped-levels) to opt into subtotals/overall (both default `false`).

**Returns** an array of [`Bin`](./histogram-kde-ecdf#histogram-d-options) rows, each flattened with
the group's key fields and `depth`.

**Reserved-field guard** — as with `summarize`: a dimension named after an output field (`x0`,
`x1`, `weight`, or `depth`) throws a `RangeError`.

**Degenerate input** — shared bin edges are derived from `overall` via `histogram()`; if `overall` is empty, `edges` is `[]` and the result is `[]`. Per-group histograms then also delegate to `histogram()` with those fixed edges — an empty or zero-mass group contributes no bins.

## `groupedKde(grouped, options?)`

One KDE curve per selected group, all sharing **identical sample points and a single bandwidth**
(derived once from the `overall` distribution unless a numeric `bandwidth` is given) — so the curves
are comparable. Returns `(KdePoint & key & { depth })[]`. Leaves only by default.

**Parameters**

- `grouped: GroupedDistribution`.
- `options?: KdeOptions & LevelSelect` — the same [`KdeOptions`](./histogram-kde-ecdf#kde-d-options)
  as `kde` (used to derive the shared grid and bandwidth from `overall`), plus
  [`LevelSelect`](#summarize-grouped-levels) (both default `false`).

`clamp` applies to the **shared** grid — it restricts the common sample points to the `overall`
distribution's `[min, max]`. Per-group curves are intentionally **not** clamped to each group's own
domain; they all share one x-axis, which is the point of a grouped KDE.

**Returns** an array of [`KdePoint`](./histogram-kde-ecdf#kde-d-options) rows, each flattened with
the group's key fields and `depth`.

**Reserved-field guard** — as above: a dimension named after an output field (`x`, `density`, or
`depth`) throws a `RangeError`.

**Degenerate input** — shared sample points and bandwidth are derived from `overall` via `kde()`; if `overall` is empty or degenerate (zero bandwidth), `template` is `[]`, `samplePoints` is `[]`, and the result is `[]`. Per-group curves delegate to `kde()` with the shared `samplePoints` and `bandwidth` — an empty or zero-mass group contributes no points.
