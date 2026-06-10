# Shape and density

Three families describe the *shape* of a distribution rather than a single summary number:
`histogram` (binned weight), `kde` (smoothed density), and `ecdf` / `cdf` (cumulative probability).
All three read directly off the prepared substrate. The figures below are computed live from the
exam-score frequency table:

<IoFigure :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" kind="histogram" caption="histogram()" />
<IoFigure :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" kind="kde" caption="kde() — gaussian default" />
<IoFigure :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" kind="ecdf" caption="ecdf()" />

## `histogram`

```ts
import { distribution, histogram, DEFAULT_MAX_AUTO_BINS } from "distribu-tron";

histogram(d);                       // auto bins via the Freedman–Diaconis rule
histogram(d, { binCount: 20 });     // target ~20 bins (approximate — edges are "nice"-rounded)
histogram(d, { maxBins: 30 });      // cap the auto bin count
histogram(d, { edges: [0, 10, 20, 30, 40] }); // explicit edges, used verbatim
```

`histogram` returns a `Bin[]`, each `{ x0, x1, weight }`. Options (`HistogramOptions`):

- **`rule: "fd"`** — the binning rule. The Freedman–Diaconis rule is the default and the only
  supported value; the option exists for forward compatibility.
- **`binCount`** — an *approximate* target bin count. The actual edges are "nice"-rounded, so the
  count can differ slightly.
- **`maxBins`** — caps the auto bin count. Defaults to **`DEFAULT_MAX_AUTO_BINS`** (`50`), which is
  exported for reference.
- **`edges`** (length ≥ 2) — explicit bin edges, sorted and used verbatim. Note that values below
  `edges[0]` or above the last edge fall *outside* the bins, so explicit edges should span the full
  data domain. (`groupedHistogram` derives shared edges from the overall distribution so this holds
  across groups.)

The interquartile range and standard deviation that drive the FD rule route through the canonical
`quantile()` / `stdev()`, so the histogram agrees with those functions.

## `kde`

```ts
import { distribution, kde, silvermanBandwidth, scottBandwidth } from "distribu-tron";

kde(d);                                  // gaussian kernel + silverman bandwidth (defaults)
kde(d, { kernel: "epanechnikov" });      // pick a kernel
kde(d, { bandwidth: 2.5 });              // numeric bandwidth = kernel standard deviation
kde(d, { bandwidth: "scott" });          // Scott's rule (alternative selector)
kde(d, { resolution: 80 });              // number of sample points across the domain
```

`kde` returns a `KdePoint[]`, each `{ x, density }`. Options (`KdeOptions`):

- **`kernel: "gaussian" | "epanechnikov" | "triangular" | "cosine"`** — the smoothing kernel,
  default `"gaussian"` (smooth and continuously differentiable).
- **`bandwidth: number | "silverman" | "scott"`** — the **kernel standard deviation**; a numeric
  value gives comparable smoothing across every kernel. `"silverman"` (default, robust) and
  `"scott"` (normal-reference) are data-driven selectors.
- **`resolution`** (default `50`) — the number of evenly spaced sample points across the domain.

> **The default just works.** With the gaussian kernel and Silverman bandwidth, `kde(d)` returns a
> smooth curve out of the box — no kernel or bandwidth tuning needed for a clean plot.

KDE returns `[]` when the resolved bandwidth is not positive — which includes the degenerate
single-value case, where the spread (and thus the bandwidth) is `0`.

The four kernels differ mostly at the tails and in smoothness — same data, same bandwidth:

<KernelComparison :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" />

> **Changed in the kernel update.** The default kernel is now **gaussian** (was Epanechnikov), and a
> numeric `bandwidth` now means the kernel **standard deviation**, not the Epanechnikov half-width.
> To reproduce an old curve, pass `{ kernel: "epanechnikov" }` and `bandwidth: h / Math.sqrt(5)`.

## `ecdf` and `cdf`

```ts
import { distribution, ecdf, cdf } from "distribu-tron";

ecdf(d);     // → EcdfPoint[], each { x, p }  — the empirical CDF as plottable steps
cdf(d, 18);  // → number in [0, 1]  — cumulative probability at a single value
```

`ecdf` returns the full step function as `EcdfPoint[]` (each `{ x, p }`), while `cdf` evaluates the
cumulative probability at one value. Both reflect the weighted mass: `p` is the fraction of total
weight at or below `x`.

## Degenerate input

All three array-returning functions return **`[]`** for an empty or zero-mass (`n ≤ 0`)
distribution, and `cdf` returns `NaN`. KDE additionally returns `[]` when the bandwidth resolves to
`≤ 0`.
