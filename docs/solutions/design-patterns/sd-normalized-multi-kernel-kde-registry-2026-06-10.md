---
title: "SD-normalized multi-kernel KDE: bandwidth = kernel standard deviation"
date: 2026-06-10
category: docs/solutions/design-patterns
module: kernel density estimation
problem_type: design_pattern
component: service_object
severity: medium
applies_when:
  - "Adding a new kernel to a KDE, or refactoring one that takes a kernel parameter"
  - "Diagnosing a jagged or under-smoothed sampled/KDE curve"
  - "Adding or comparing bandwidth selectors (Silverman, Scott) across kernels"
  - "Keeping grouped/overlaid density series comparable across kernel choices"
  - "Centralizing a numeric formula that was previously duplicated and had silently drifted"
tags:
  - kde
  - kernel-density-estimation
  - bandwidth
  - gaussian-kernel
  - statistics
  - pluggable-registry
  - silverman
  - scott
---

# SD-normalized multi-kernel KDE: bandwidth = kernel standard deviation

## Context

`distribu-tron`'s `kde()` originally supported only the Epanechnikov kernel and rendered visibly
**jagged** density curves by default. The instinctive first hypothesis was a sampling-resolution
problem — "is `DEFAULT_RESOLUTION = 50` too coarse (or too fine)?"

That hypothesis was disproven empirically. Measuring the number of local **extrema** (sign changes
in the finite difference of the density values) as resolution increased, at the Silverman bandwidth:

| Resolution | Extrema |
| --- | --- |
| 20  | 1  |
| 50  | 31 |
| 100 | 33 |
| 200 | 39 |
| 400 | 41 |

The extrema **converge** toward ~41 rather than growing without bound. Converging extrema mean the
bumps are real features of an **under-smoothed density**, not a sampling artifact — finer sampling
reveals them; coarser sampling only hides them by aliasing real structure away. Resolution was never
the lever.

The two real causes were: (1) the Epanechnikov kernel's compact support has **hard support-edge
kinks**; and (2) a bandwidth **scale mismatch** — `silvermanBandwidth` returns a value on the
Gaussian **standard-deviation** scale (`1.06·A·n^(−1/5)`), but the old `density()` fed it in as the
Epanechnikov **half-width**, under-smoothing by a factor of √5 ≈ 2.236.

## Guidance

**1. The extrema-vs-resolution diagnostic.** When a sampled curve looks jagged, before touching any
parameter, count local extrema as you raise resolution from a low baseline. **Converging** extrema ⇒
the structure is real (the kernel/bandwidth is the lever, not the sample count). Extrema that keep
**growing in proportion** to resolution ⇒ a genuine sampling artifact (resolution is the lever).
Lowering resolution to "smooth" a converged curve is just aliasing.

```ts
function countExtrema(ys: number[]): number {
  let count = 0;
  for (let i = 1; i < ys.length - 1; i++) {
    if ((ys[i] - ys[i - 1]) * (ys[i + 1] - ys[i]) < 0) count++;
  }
  return count;
}
```

**2. Define `bandwidth` as the kernel standard deviation; map SD → native scale via `sdScale`.**
Under the convention that `bandwidth` (`h`) means the kernel's standard deviation (matching R's
`density()` and scipy), each kernel maps `h` to its own native scale `a = h · sdScale`. The density
is `f(x) = (1/n) Σ wᵢ · (1/a) · K((x − xᵢ)/a)` over a binary-searched window
`[x − radius·h, x + radius·h]`:

| Kernel | `sdScale` (a / h) | `radius` (×h) | Notes |
| --- | --- | --- | --- |
| gaussian | 1 | 4 | `a = σ`; truncated at ±4σ |
| epanechnikov | √5 ≈ 2.236 | √5 | compact support |
| triangular | √6 ≈ 2.449 | √6 | compact support |
| cosine | 1/√(1−8/π²) ≈ 2.298 | ≈ 2.298 | compact support |

The payoff: a bandwidth **selector** that returns an SD-scale value feeds **every** kernel correctly
with no per-kernel rescale at the call site — selectors and kernels become independently composable.

**3. Kernel registry + resolve-once.** Store kernels as records keyed by name; resolve once per
`kde()` call and hold a single reference in the hot loop (no `switch` per sample point):

```ts
interface Kernel {
  name: KdeKernel;
  k(u: number): number; // unit kernel: integrates to 1; |u|≤1 for compact kernels
  sdScale: number;      // a = bandwidth · sdScale
  radius: number;       // window half-width in bandwidth units
}
```

The correctness contract for each kernel is **unit integral = 1 and variance = 1/sdScale²** — that
is exactly what makes `bandwidth` equal the kernel's standard deviation, and it is worth a unit test
per kernel (numeric integration).

**4. One shared bandwidth resolver — no formula drift.** A single
`resolveBandwidth(d, bw): number` (in `internal/silverman.ts`) maps `number | "silverman" | "scott"`
to a numeric SD-scale bandwidth, and is used by **both** `kde()` and `groupedKde()`:

- `"silverman"` → `1.06 · min(σ, IQR/1.349) · n^(−1/5)` (robust)
- `"scott"` → `1.06 · σ · n^(−1/5)` (normal-reference)
- `number` → passes through

This directly prevents the class of bug the library had already hit: two copies of the Silverman
formula that silently diverged. Keep bandwidth logic in exactly one place.

**5. ±Nσ truncation keeps the windowed evaluation for infinite-support kernels.** Gaussian has
infinite support, but the library's performance rests on a binary search over the cumulative-weight
array plus a scan of only the contributing window. Truncating Gaussian at `radius = 4` (±4σ,
> 99.99% of the mass) preserves that windowed pattern uniformly across all kernels. For grouped KDE,
derive the shared sample grid + bandwidth **once** from the overall (Gaussian) distribution and pass
them as `samplePoints` to every per-group evaluation, so overlaid series stay comparable across
kernel choices.

## Why This Matters

- **Comparability:** without the SD convention, a bandwidth of `0.5` means a different amount of
  smoothing to every kernel — you can't swap kernels and compare. SD-scale + `sdScale` fixes that.
- **Correct selectors:** Silverman/Scott are derived for a Gaussian σ. Feeding that value as an
  Epanechnikov half-width under-smooths by √5; the `sdScale` mapping is the correction (at the
  corrected scale, Epanechnikov's extrema for the same data dropped from **31 → 3**).
- **Smooth defaults:** Gaussian is the right user-facing default — smooth, no support-edge kinks.
- **No drift:** one `resolveBandwidth` removes a whole bug class.
- **Performance preserved:** the windowed binary-search evaluation still works for every kernel.

## When to Apply

- Implementing or refactoring a KDE (or any kernel-smoothed estimator) that takes a kernel parameter.
- Adding a bandwidth selector — always emit SD-scale so it feeds all kernels.
- Adding a kernel — derive `sdScale` from the kernel's analytical variance; set `radius` to the
  support boundary (compact) or a negligible-tail truncation point (infinite support).
- Diagnosing a jagged sampled curve — run the extrema-vs-resolution test before changing parameters.
- Choosing a default kernel — default to Gaussian unless a compact-support property is specifically
  needed.

## Examples

**`sdScale` derivation (Epanechnikov).** `K(u) = ¾(1 − u²)` on `|u| ≤ 1` has
`Var(K) = ∫₋₁¹ u²·¾(1 − u²) du = 1/5`, so `SD = 1/√5`. To make the kernel's SD equal `h`, the native
half-width must be `a = h·√5` → `sdScale = √5`.

**Before / after (scale correction).**

```text
# BEFORE — Silverman value (SD scale) used directly as the Epanechnikov half-width:
a = h_silverman                 # WRONG: SD ≠ half-width → too small by √5 → 31 extrema

# AFTER — SD convention with per-kernel sdScale:
a = h_silverman * Math.sqrt(5)  # a = bandwidth · sdScale → 3 extrema
```

**Migration for callers who passed an Epanechnikov half-width numerically:**
`h_new (SD) = h_old (half-width) / Math.sqrt(5)`.

**Shared resolver usage (never inline the formula):**

```ts
import { resolveBandwidth } from "./internal/silverman";
import { resolveKernel } from "./internal/kernels";

const bw = resolveBandwidth(d, options.bandwidth);          // number | "silverman" | "scott" → SD
const kernel = resolveKernel(options.kernel);              // defaults to gaussian
const a = bw * kernel.sdScale;                             // native scale, once per call
// ... windowed scan: acc += (wᵢ / n) * kernel.k((x - xᵢ) / a) / a
```

## Related

- Design spec: [`docs/designs/2026-06-10-kde-kernels-design.md`](../../designs/2026-06-10-kde-kernels-design.md) — motivation, decisions, and the SD-normalization table.
- Implementation plan: [`docs/plans/2026-06-10-kde-kernels.md`](../../plans/2026-06-10-kde-kernels.md).
- Source: `packages/distribu-tron/src/internal/kernels.ts` (registry), `internal/silverman.ts` (shared `resolveBandwidth` + Silverman/Scott), `kde.ts` (windowed kernel-driven `density()`), `group.ts` (`groupedKde` shared grid).
- Note: CLAUDE.md's "don't re-duplicate the Silverman formula" invariant and the KDE degenerate-input contract are worth a quick re-read now that `resolveBandwidth`/Scott exist.
