# Grouped plots

`groupedHistogram()` and `groupedKde()` compute one series per group — but with a **shared domain**,
so the series overlay cleanly on a single chart.

```ts
import { group, groupedHistogram, groupedKde } from "distribu-tron";

const grouped = group(rows, { by: "region", value: "score", weight: "count" });

const bars   = groupedHistogram(grouped);
const curves = groupedKde(grouped);
```

## The shared-domain idea

If each group computed its own histogram edges or KDE bandwidth, the series wouldn't line up:
different bin boundaries, different smoothing, no honest comparison. Instead, both consumers derive a
**single shared domain from the overall distribution** (`gd.overall`, which spans every group's
range):

- **`groupedHistogram`** computes one set of bin **edges** from the overall distribution and reuses
  those exact edges for every group's histogram.
- **`groupedKde`** computes one set of **sample points** *and* a **single bandwidth** from the overall
  distribution (unless you pass a numeric `bandwidth`), then evaluates every group's curve on them.

Because the edges/points come from the overall distribution — which spans the full domain — no
group's values fall outside the shared bins.

## Options and the returned shape

Both accept their per-plot options merged with `LevelSelect`:

```ts
groupedHistogram(grouped, { binCount: 20 });            // HistogramOptions & LevelSelect
groupedKde(grouped, { bandwidth: 2.5 });                // KdeOptions & LevelSelect
groupedHistogram(grouped, { includeSubtotals: true });  // also emit rollup levels
```

By default they emit **leaves only**. Pass `{ includeSubtotals: true }` / `{ includeOverall: true }`
to also emit rollup levels (which requires the original `group()` call to have used `rollup: true`).

Each returns a **flat array of tagged rows** — the plot point flattened with the group's key fields
and `depth`, so you can split into series by key:

```ts
// groupedHistogram → Array<{ x0, x1, weight, depth, ...keyFields }>
[
  { x0: 0, x1: 4, weight: 12, region: "east", depth: 1 },
  { x0: 4, x1: 8, weight: 31, region: "east", depth: 1 },
  // …
  { x0: 0, x1: 4, weight: 9,  region: "west", depth: 1 },
  // …
];

// groupedKde → Array<{ x, density, depth, ...keyFields }>
[
  { x: 0, density: 0.004, region: "east", depth: 1 },
  // …
];
```

Group the rows by their key fields to recover one series per group; because every series shares the
same `x0`/`x1` edges (histogram) or `x` sample points (KDE), they stack and overlay directly. The
[reserved-field guard](./grouping#reserved-field-guard) applies here: a dimension named after an
output field (`x0`, `x1`, `weight`, `x`, `density`, `depth`) throws.
