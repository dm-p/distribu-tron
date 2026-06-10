# Design — KDE kernels & bandwidth selectors (Phase 2, part 1)

**Date:** 2026-06-10
**Branch:** `feat/kde-kernels` (off `main`)
**Status:** Approved (brainstorm) — pending implementation plan
**Roadmap:** Phase 2 · density — kernels + bandwidth selectors (`KdeOptions.kernel` / `bandwidth`).

## Motivation

The KDE currently supports only the Epanechnikov kernel, whose compact support has hard edges
(kinks), and — combined with a scale mismatch (below) — produces visibly **jagged** curves by
default. For a library that markets "plot-ready" output, a jagged default KDE will confuse users at
beta. This branch adds a smooth **Gaussian** default plus kernel selection, and corrects the
bandwidth scaling, so `kde()` looks right out of the box.

Investigation (2026-06-10) established the jaggedness is **not** a sampling-resolution problem
(`DEFAULT_RESOLUTION = 50` is fine; extrema converge as resolution rises, i.e. the bumps are real
features of the undersmoothed density). The real causes are the kernel (hard support edges) and a
bandwidth **scale mismatch**: `silvermanBandwidth` returns a value on the Gaussian standard-deviation
scale (`1.06·A·n^(−1/5)`), but `density()` feeds it in as the Epanechnikov *half-width* — under-smoothing.

## Decisions (locked in brainstorm)

| Decision | Choice |
| --- | --- |
| Default kernel | **Gaussian** (was Epanechnikov). Behavior change, acceptable pre-beta. |
| Kernels shipped | **gaussian, epanechnikov, triangular, cosine** (full Phase 2 kernel set). |
| Bandwidth selectors | **Silverman (existing) + Scott (new)**. Cross-validation (`"cv"`) deferred. |
| `bandwidth` semantics | **Kernel standard deviation** (R/scipy-style, normalized). Each kernel maps SD → its native scale internally. |
| Gaussian support | **Truncated at ±4σ** (≈99.99% mass) to keep the windowed binary-search evaluation. |
| Docs site | Out of scope here; folded in when `feat/docs-site` resumes. This branch updates root `README` only. |

## Architecture & units

A new kernel-strategy module, consumed by a kernel-driven `kde()`:

- **`src/internal/kernels.ts`** (new) — each kernel as a record `{ name, k(u), sdScale, radius }` plus
  `resolveKernel(name)`. Pure math; no `Distribution` dependency. `k(u)` is the unit kernel
  (integrates to 1); `sdScale` is the native half-width per unit SD; `radius` is the window half-width
  in bandwidth (SD) units.
- **`src/kde.ts`** (modify) — resolve kernel + bandwidth **once**; `density()` uses the resolved
  kernel's `k`, native scale `a = bandwidth · sdScale`, and window `[x − radius·bw, x + radius·bw]`
  via the existing binary-search bounds. No per-iteration branching.
- **`src/internal/silverman.ts`** (modify) — add `scottBandwidth`; keep `silvermanBandwidth` signature.
- **`src/types.ts`** (modify) — widen `KdeOptions.kernel` and `KdeOptions.bandwidth`; export a
  `KdeKernel` string-union type.
- **`src/group.ts`** (modify) — forward `kernel` through `groupedKde` so overlaid series share it.

### Architectural approach

Kernel **registry + resolve-once** (chosen over an inline `switch` in the hot loop, or four
duplicated density functions). The registry gives per-kernel isolation and testability; resolving to
a single function reference before the loop gives the performance of a specialized function with no
per-iteration branch.

## Kernel math (SD-normalized) — the core

`bandwidth` (`h`) is the kernel's **standard deviation**. For each kernel, the native scale `a` is set
so the kernel's SD equals `h`; the density is
`f(x) = (1/n) Σ wᵢ · (1/a) · K((x − xᵢ)/a)` over the windowed points.

| kernel | unit `K(u)` (support) | native scale `a` | `sdScale` (a/h) | window radius (×h) |
| --- | --- | --- | --- | --- |
| gaussian | `(1/√(2π))·e^(−u²/2)` (ℝ) | `a = h` | `1` | `4` (±4σ truncation) |
| epanechnikov | `¾(1−u²)`, `\|u\|≤1` | `a = h·√5` | `√5 ≈ 2.2360680` | `√5` |
| triangular | `1−\|u\|`, `\|u\|≤1` | `a = h·√6` | `√6 ≈ 2.4494897` | `√6` |
| cosine | `(π/4)·cos(πu/2)`, `\|u\|≤1` | `a = h/√(1−8/π²)` | `1/√(1−8/π²) ≈ 2.2980993` | same |

Derivations (kernel variance in native `[−1,1]` units): Epanechnikov `1/5`, triangular `1/6`, cosine
`1−8/π²`; so SD = √variance and `a = h / SD_native`. Gaussian is already unit-SD, so `a = h`.

For compact kernels the window radius equals `a` (support is `[−a, a]`). For Gaussian the support is
infinite; we truncate the scan at `±4a = ±4h`. Truncation drops ≈ `6.3e-5` of each kernel's mass; we
**do not renormalize** (the loss is negligible and uniform across sample points, so it does not
distort the curve's shape). A test bounds the resulting integral-of-density error (see Testing).

## Bandwidth rules

Both selectors return an **SD-scale** bandwidth, so under SD semantics they apply unchanged to *every*
kernel (no per-kernel rescale):

- **`"silverman"`** (default; formula unchanged): `1.06 · min(σ, IQR/1.349) · n^(−1/5)` — robust to
  outliers/heavy tails via the IQR term.
- **`"scott"`** (new): `1.06 · σ · n^(−1/5)` — normal-reference, σ only.

`silvermanBandwidth(n, iqr, sd)` and `silvermanFor(d)` keep their signatures. Add `scottBandwidth(n, sd)`
and a `scottFor(d)` mirroring `silvermanFor`. `resolveBandwidth` in `kde.ts` gains a `"scott"` branch.

## API / types

```ts
export type KdeKernel = "gaussian" | "epanechnikov" | "triangular" | "cosine";

export interface KdeOptions {
  bandwidth?: number | "silverman" | "scott"; // default "silverman"; numeric = kernel SD
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  kernel?: KdeKernel;                          // default "gaussian"
}
```

`scottBandwidth` is exported from the barrel alongside `silvermanBandwidth`.

## Behavior change (pre-beta, documented)

1. **Default kernel is now Gaussian** — `kde(d)` returns a smooth curve. `kde(d, { kernel: "epanechnikov" })`
   selects the previous kernel.
2. **Numeric `bandwidth` now means the kernel SD**, not the Epanechnikov half-width. The same number
   produces comparable smoothing across kernels. Old code passing a numeric Epanechnikov half-width
   `h_old` maps to the new SD scale via `h_new = h_old / √5`.

Both are called out in the root `README` KDE section and a `CHANGELOG`/release note. We are at
`0.1.0-beta.1`; this lands before stable, so no deprecation cycle is owed.

## Degenerate-input contracts (unchanged)

- Empty / zero-mass (`n ≤ 0`) → `[]`.
- Resolved bandwidth `≤ 0` (incl. single-value distribution where Silverman/Scott = 0) → `[]`.
- `clamp` trims to `[min, max]`; `samplePoints` overrides the grid verbatim; `trimZeroTails` for the
  default grid. All preserved across kernels.

## groupedKde

`groupedKde` derives shared `samplePoints` + one `bandwidth` from `gd.overall` and reuses them per
group. It must also forward the chosen `kernel` so every series uses the same kernel. A test asserts
overlaid series share kernel + bandwidth + sample grid.

## Performance

Evaluation stays windowed via binary search. Gaussian's `±4σ` window is wider than the compact
kernels' (`±√5σ ≈ 2.24σ` … `±√6σ ≈ 2.45σ`), so Gaussian sums more points per sample point — bounded,
and algorithmic complexity is unchanged. `bench/` gains a per-kernel comparison (comparison-only, no
asserts, per repo convention).

## Testing (TDD)

- **`kernels.spec.ts`** (new): each unit kernel integrates to ≈ 1 and has unit variance over a fine
  grid (the SD-normalization is the correctness contract); `resolveKernel` returns the right record;
  `sdScale`/`radius` match the table.
- **`kde.spec.ts`** (extend): default kernel is Gaussian; a deliberately undersmoothed dataset (the
  exam-score table) yields a smooth curve (few extrema) under Gaussian default; the same numeric
  `bandwidth` across kernels yields comparable spread (variance of the resulting density within
  tolerance); Gaussian ±4σ truncation error is below a small bound; `clamp` / `samplePoints` /
  `trimZeroTails` / degenerate paths still hold per kernel.
- **bandwidth rules** (extend silverman tests): `scottBandwidth` formula; `scottFor` uses weighted σ;
  Scott vs Silverman differ only by the IQR-robustness term.
- **`group` tests** (extend): `groupedKde` forwards `kernel`; overlaid series share kernel + bandwidth
  + grid.

## Out of scope

- Cross-validation bandwidth (`"cv"`) — separate, larger algorithm.
- Phase 3 binning rules.
- Docs-site (`apps/docs`) updates — handled when `feat/docs-site` resumes.
- Additional kernels beyond the four (e.g. biweight/triweight) — reserved for later if needed.
