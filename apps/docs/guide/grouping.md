# Grouping

`group()` is the grouping layer: it buckets rows into **one `Distribution` per key**, with optional
prefix-ROLLUP subtotals and a grand total.

```ts
import { group } from "distribu-tron";

const grouped = group(rows, {
  by: ["region", "product"],   // one or more grouping dimensions
  value: "score",              // where the value comes from
  weight: "count",             // where the weight comes from (optional)
  rollup: true,                // add prefix-ROLLUP subtotals + grand total
});
```

## The spec

`group(rows, spec)` takes an array of plain row objects and a `GroupSpec`:

- **`by: string | string[]`** — the grouping dimension(s). With multiple dimensions, rows are bucketed
  by the full tuple of key values.
- **`value: string | (row) => number`** — an accessor for each row's value: a property name, or a
  function returning a number.
- **`weight?: string | (row) => number`** — an accessor for each row's weight. Omit it to weight
  every row equally (1).
- **`rollup?: boolean`** — when `true`, emit prefix-ROLLUP subtotals and a grand total in addition to
  the leaf groups.
- **`totalLabel?: string | null`** — the key value placed on rolled-up dimensions. **Defaults to
  `null`**, so a rolled-up dimension reads as `null` in the key — handy for filtering subtotal rows.
- **`sorted?: boolean`** — the trust-the-caller fast path forwarded to each leaf `distribution()`
  (skips the per-group sort/aggregate). Rollup buckets concatenate across groups and are always
  re-sorted regardless.

## The result shapes

`group()` returns a `GroupedDistribution`:

```ts
interface GroupedDistribution {
  readonly dimensions: string[];          // the `by` dimensions, in order
  readonly groups: DistributionGroup[];   // every emitted group (leaves + any rollup levels)
  readonly leaves: DistributionGroup[];   // only the fully-keyed leaf groups
  readonly overall: Distribution;         // the grand-total distribution over all rows
}
```

Each group is a `DistributionGroup`:

```ts
interface DistributionGroup {
  readonly key: Record<string, GroupKeyValue>; // one entry per dimension
  readonly level: string[];   // dimensions still active (not rolled up)
  readonly depth: number;     // level.length
  readonly distribution: Distribution;
}
```

## Prefix-ROLLUP subtotals

With `rollup: true`, for dimensions `[a, b, c]` the result includes, on top of the leaves
`(a, b, c)`:

- subtotals over each shrinking prefix — `(a, b, *)`, then `(a, *, *)` — where `*` is the
  `totalLabel`;
- a single **grand total** `(*, *, *)`.

Each level is tagged by its **`level`** (the dimensions still active) and **`depth`** (how many).
The grand total has `depth === 0` and `level === []`; a full leaf has `depth === dimensions.length`.
Consumers like [`summarize`](./summarize) and the [grouped plots](./grouped-plots) select which
levels to emit by depth.

## Reserved-field guard

The grouped consumers flatten each group's key fields directly onto every output row, alongside the
statistic/bin fields and a `depth` field. To prevent a silent overwrite, naming a grouping dimension
after a reserved output field — `depth`, or any statistic/bin field such as `weight`, `x`, `n`,
`median`, `min`, `max` — **throws a `RangeError`**. Rename the dimension if you hit this.
