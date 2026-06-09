# Histogram, KDE, ECDF

Plot-ready shape and density series, all read from the prepared
[`Distribution`](./distribution#the-distribution-object).

```ts
import { histogram, DEFAULT_MAX_AUTO_BINS, kde, silvermanBandwidth, ecdf, cdf } from "distribu-tron";
```

## `histogram(d, options?)`

Weighted histogram over the prepared distribution. Bins are right-open `[x0, x1)` except the final
bin, which is closed so `d.max` lands in it. Total bin weight equals `d.n`. Returns `Bin[]`.

**Parameters**

- `d: Distribution`.
- `options?: HistogramOptions` — binning controls (see below).

**`Bin`**

```ts
interface Bin {
  x0: number; // left edge (inclusive)
  x1: number; // right edge (exclusive, except the final bin which is inclusive)
  weight: number; // total weight falling in [x0, x1)
}
```

**`HistogramOptions`**

```ts
interface HistogramOptions {
  binCount?: number; // approximate target number of bins
  maxBins?: number; // cap for the auto bin count (default DEFAULT_MAX_AUTO_BINS = 50)
  rule?: "fd"; // binning rule; only "fd" (Freedman–Diaconis) is supported, and it is the default
  edges?: number[]; // explicit boundaries (length ≥ 2), used verbatim (sorted)
}
```

Binning behavior:

- **`edges`** (length ≥ 2) — used verbatim after sorting. Values below `edges[0]` fall into the
  first bin and values above the last edge into the last bin (weight is conserved, but those bins'
  `x0`/`x1` won't describe the absorbed values). Edges should span the full data domain.
- Otherwise a **capped Freedman–Diaconis** bin count (Scott's rule fallback when IQR = 0) with
  `niceStep` boundary rounding. `binCount` / `maxBins` are **approximate** targets — nice-step
  rounding and domain expansion to nice boundaries can shift the final count up or down.
- **`rule`** accepts only `"fd"` (the default); it exists for forward-compatibility.

**Returns** `Bin[]` — one entry per bin, in ascending edge order.

**Degenerate input** — returns `[]` when `size === 0`. When all mass is on a single value
(`d.min === d.max`), returns one bin `[{ x0: d.min, x1: d.max, weight: d.n }]`.

## `DEFAULT_MAX_AUTO_BINS`

```ts
const DEFAULT_MAX_AUTO_BINS = 50;
```

The default cap (`50`) applied to the auto-computed Freedman–Diaconis bin count when neither
`binCount` nor `maxBins` is supplied.

## `kde(d, options?)`

Windowed Epanechnikov kernel density estimate over the prepared distribution. Returns `KdePoint[]`.

**Parameters**

- `d: Distribution`.
- `options?: KdeOptions` — bandwidth, grid, and kernel controls (see below).

**`KdePoint`**

```ts
interface KdePoint {
  x: number; // sample point on the x-axis
  density: number; // estimated density at x
}
```

**`KdeOptions`**

```ts
interface KdeOptions {
  bandwidth?: number | "silverman"; // numeric width, or "silverman" (the default)
  resolution?: number; // number of interior sample points (default 50)
  clamp?: boolean; // restrict the grid to [d.min, d.max] (default false)
  samplePoints?: ArrayLike<number>; // explicit x grid; overrides resolution/clamp entirely
  kernel?: "epanechnikov"; // only "epanechnikov" is supported (the default)
}
```

- **`bandwidth`** — a positive number passes through; `"silverman"` (the default) derives the
  bandwidth from the distribution via [`silvermanBandwidth`](#silvermanbandwidth-n-iqr-sd) using the
  canonical interpolated IQR and weighted population stdev.
- **`resolution`** (default `50`) — the number of interior sample points; the grid is padded with
  tapering buffer points on each side unless `clamp` is set.
- **`clamp`** (default `false`) — when `true`, anchors the grid to exactly `[d.min, d.max]` and
  drops points outside it (no tapering tails). When `false`, the result is trimmed of leading/trailing
  all-zero tails.
- **`samplePoints`** — an explicit x grid. When provided it is used exactly as given (no padding,
  trimming, or clamping); `resolution` and `clamp` are ignored.
- **`kernel`** — only `"epanechnikov"` is supported; present for forward-compatibility.

**Returns** `KdePoint[]` — `{ x, density }` points along the sample grid.

**Degenerate input** — returns `[]` for an empty or zero-mass distribution, and also whenever the
resolved bandwidth is not positive. This includes the single-value case (zero spread ⇒ Silverman
bandwidth `0`): pass an explicit numeric `bandwidth` to force a curve there.

## `silvermanBandwidth(n, iqr, sd)`

Silverman's rule-of-thumb bandwidth: `1.06 · A · n^(−1/5)`, where the spread estimate
`A = min(IQR / 1.349, stdev)` — falling back to `stdev` when `iqr` is `0`. Returns `number`.

**Parameters**

- `n: number` — effective sample size (total weight).
- `iqr: number` — the interquartile range.
- `sd: number` — the standard deviation.

**Returns** `number` — the bandwidth.

**Degenerate input** — when both `iqr` and `sd` are `0` (e.g. a single-value distribution), `A = 0` and the function returns `0`. When `n ≤ 0`, `n^(−1/5)` diverges and the result is `Infinity` (or `NaN` if `A` is also `0`). In practice `kde()` treats any non-positive bandwidth as degenerate and returns `[]`.

::: tip
`kde()` derives its default bandwidth internally from the distribution (using the canonical
interpolated IQR and weighted population `stdev`). Call `silvermanBandwidth` directly only when you
want to compute or adjust the bandwidth by hand.
:::

## `ecdf(d)`

The empirical cumulative distribution function as one point per distinct value:
`p = cumulative / n`. Returns `EcdfPoint[]`.

**Parameters** — `d: Distribution`.

**`EcdfPoint`**

```ts
interface EcdfPoint {
  x: number; // a distinct value
  p: number; // P(X ≤ x) = cumulative[i] / n, in (0, 1]
}
```

**Returns** `EcdfPoint[]` — one `{ x, p }` per distinct value, ascending; the final `p` is `1`.

**Degenerate input** — returns `[]` for an empty or zero-mass distribution.

## `cdf(d, value)`

`P(X ≤ value)` at an arbitrary threshold — an alias for
[`percentileRank(d, value)`](./quantiles-boxplot#percentilerank-d-value). Returns `number`.

**Parameters**

- `d: Distribution`.
- `value: number` — the threshold (need not be present in the distribution).

**Returns** `number` — the fraction of total weight at or below `value`, in `[0, 1]`.

**Degenerate input** — returns `NaN` for an empty or zero-mass distribution.
