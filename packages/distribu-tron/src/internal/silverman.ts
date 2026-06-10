import type { Distribution, KdeOptions } from "../types";
import { quantile } from "../quantiles";
import { stdev } from "../descriptives";

/**
 * Robust Silverman rule-of-thumb bandwidth: `1.06 · A · n^(-1/5)`, where the spread estimate
 * `A = min(stdev, IQR/1.349)`. When the IQR is 0 (a heavily tied distribution where ≥50% of the
 * mass sits on one value), `A` falls back to `stdev`, so a peaked-but-spread sample still gets a
 * positive bandwidth rather than collapsing to 0 (which would make `kde()` return an empty curve).
 */
export function silvermanBandwidth(n: number, iqr: number, sd: number): number {
  const a = iqr > 0 ? Math.min(iqr / 1.349, sd) : sd;
  return 1.06 * a * Math.pow(n, -0.2);
}

/**
 * Derive a Silverman bandwidth from a prepared distribution, using the SAME interpolated IQR as the
 * public `quartiles()`/`quantile()` API and the weighted population `stdev()` — so the bandwidth a
 * caller can reconstruct by hand matches the one the library uses internally. Returns 0 for an
 * empty or degenerate (single-value) distribution.
 */
export function silvermanFor(d: Distribution): number {
  if (d.size === 0 || d.n <= 0) return 0;
  const iqr = quantile(d, 0.75) - quantile(d, 0.25);
  return silvermanBandwidth(d.n, iqr, stdev(d));
}

/**
 * Scott's normal-reference bandwidth: `1.06 · sd · n^(-1/5)`. Like Silverman but without the robust
 * `min(·, IQR/1.349)` term, so it uses the full standard deviation. Returns a standard-deviation-scale
 * bandwidth, matching the `bandwidth = kernel SD` convention.
 */
export function scottBandwidth(n: number, sd: number): number {
  return 1.06 * sd * Math.pow(n, -0.2);
}

/** Derive Scott's bandwidth from a prepared distribution (weighted population stdev). 0 if degenerate. */
export function scottFor(d: Distribution): number {
  if (d.size === 0 || d.n <= 0) return 0;
  return scottBandwidth(d.n, stdev(d));
}

/**
 * Resolve a `KdeOptions["bandwidth"]` to a numeric standard-deviation bandwidth. Numeric values pass
 * through; `"scott"` and `"silverman"` (the default) derive from the distribution. Shared by `kde()`
 * and `groupedKde()` so the two never drift.
 */
export function resolveBandwidth(d: Distribution, bw: KdeOptions["bandwidth"]): number {
  if (typeof bw === "number") return bw;
  if (bw === "scott") return scottFor(d);
  return silvermanFor(d);
}
