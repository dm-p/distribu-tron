import type { Distribution, QuantileMethod } from "./types";

/** First index whose cumulative weight is strictly greater than `r` (expanded rank). */
function indexAtRank(d: Distribution, r: number): number {
  let lo = 0,
    hi = d.distinctCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (d.cumulativeWeights[mid]! <= r) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, d.distinctCount - 1);
}
function valueAtRank(d: Distribution, r: number): number {
  const clamped = Math.max(0, Math.min(r, d.n - 1));
  return d.values[indexAtRank(d, clamped)]!;
}

/**
 * Weighted quantile at probability `p ∈ [0,1]`. Reduces to the standard type-7 quantile for unit
 * weights. `method` defaults to `"linear"` (interpolate between order statistics); `"lower"`/`"higher"`/
 * `"nearest"` (round half away from zero)/`"midpoint"` select discrete order statistics instead.
 *
 * **Weights are frequencies.** Type-7 is a finite-sample estimator, so the total weight `n` (Σ weight)
 * acts as the effective sample size that the rank `p · (n − 1)` interpolates over. This is exact for
 * count weights (a frequency table) and any weights whose sum is ≫ 1. **Probability/importance weights
 * that sum to ≈ 1 are degenerate**: `n − 1 ≈ 0`, so every quantile collapses to the smallest value.
 * Scale such weights to a count-like magnitude before calling (e.g. `weight × 1000`), or use the
 * scale-invariant {@link percentileRank} / {@link cdf} (and `mad`'s step-median), which normalize by `n`.
 *
 * @throws {RangeError} if `p` is outside `[0,1]`.
 * @returns `NaN` for an empty or zero-mass distribution.
 */
export function quantile(d: Distribution, p: number, opts: { method?: QuantileMethod } = {}): number {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p must be in [0,1], got ${p}`); // also rejects NaN
  if (d.distinctCount === 0 || d.n <= 0) return NaN;
  if (d.distinctCount === 1) return d.values[0]!;
  const method = opts.method ?? "linear";
  const h = p * (d.n - 1); // 0-indexed expanded rank
  const lo = Math.floor(h);
  const frac = h - lo;
  switch (method) {
    case "lower":
      return valueAtRank(d, lo);
    case "higher":
      return valueAtRank(d, Math.ceil(h));
    case "nearest":
      return valueAtRank(d, Math.round(h));
    case "midpoint":
      return (valueAtRank(d, lo) + valueAtRank(d, Math.ceil(h))) / 2;
    default: {
      // "linear" — the default method
      const vLo = valueAtRank(d, lo);
      if (frac === 0) return vLo;
      const vHi = valueAtRank(d, lo + 1);
      return vLo + frac * (vHi - vLo);
    }
  }
}

export function median(d: Distribution): number {
  return quantile(d, 0.5);
}

export function quartiles(d: Distribution): { q1: number; q2: number; q3: number; iqr: number } {
  const q1 = quantile(d, 0.25),
    q2 = quantile(d, 0.5),
    q3 = quantile(d, 0.75);
  return { q1, q2, q3, iqr: q3 - q1 };
}

/** P(X ≤ value): cumulative weight of all values ≤ `value`, divided by n. */
export function percentileRank(d: Distribution, value: number): number {
  if (d.distinctCount === 0 || d.n <= 0) return NaN;
  let lo = 0,
    hi = d.distinctCount; // first index with values[i] > value
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (d.values[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  const cum = lo === 0 ? 0 : d.cumulativeWeights[lo - 1]!;
  return cum / d.n;
}
