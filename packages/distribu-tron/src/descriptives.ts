import type { Distribution } from "./types";
import { neumaierSumMap } from "./internal/sum";

/** Σ value·weight. */
export function sum(d: Distribution): number {
  return neumaierSumMap(d.distinctCount, (i) => d.values[i]! * d.weights[i]!);
}

export function mean(d: Distribution): number {
  return d.n > 0 ? sum(d) / d.n : NaN;
}

export function min(d: Distribution): number {
  return d.min;
}
export function max(d: Distribution): number {
  return d.max;
}
export function range(d: Distribution): number {
  return d.distinctCount ? d.max - d.min : NaN;
}

function centralMoment(d: Distribution, m: number, mu: number): number {
  return neumaierSumMap(d.distinctCount, (i) => d.weights[i]! * Math.pow(d.values[i]! - mu, m));
}

export function variance(d: Distribution, opts: { sample?: boolean } = {}): number {
  if (d.distinctCount === 0 || d.n <= 0) return NaN; // empty / no observation mass — undefined, like mean
  const denom = opts.sample ? d.n - 1 : d.n;
  if (denom <= 0) return NaN; // sample variance needs n > 1; otherwise undefined (0/0)
  const mu = mean(d);
  const v = centralMoment(d, 2, mu) / denom;
  return v > 0 && Number.isFinite(v) ? v : 0;
}

export function stdev(d: Distribution, opts: { sample?: boolean } = {}): number {
  return Math.sqrt(variance(d, opts));
}

/**
 * Weighted **lower** median of sorted-distinct (values, cumulative) — shared by mad and quantiles.
 * Returns the first value whose inclusive cumulative weight reaches `n/2` (a step/order-statistic
 * median, NOT linear interpolation). This intentionally differs from `quantile(d, 0.5)` (type-7
 * linear) — `mad` and any caller wanting the exact-observation median use this; box-plot medians use
 * the interpolated quantile. `cumulative[i]` must be the inclusive running weight; `n` the total weight.
 */
export function weightedMedianSorted(values: ArrayLike<number>, cumulative: ArrayLike<number>, n: number): number {
  const size = values.length;
  if (size === 0 || n <= 0) return NaN;
  const target = n / 2;
  for (let i = 0; i < size; i++) if (cumulative[i]! >= target) return values[i]!;
  return values[size - 1]!;
}

export function mode(d: Distribution): number {
  if (d.distinctCount === 0) return NaN;
  let best = 0;
  for (let i = 1; i < d.distinctCount; i++) if (d.weights[i]! > d.weights[best]!) best = i; // first max = smallest value
  return d.values[best]!;
}

export function mad(d: Distribution): number {
  if (d.distinctCount === 0) return NaN;
  const med = weightedMedianSorted(d.values, d.cumulativeWeights, d.n);
  // Build sorted (deviation, weight) pairs, then walk the weighted lower-median directly.
  // (Deviations re-sort the domain, so we can't reuse d.cumulativeWeights; the inline walk avoids
  // allocating a second cumulative array over the deviations.)
  const pairs = Array.from(
    { length: d.distinctCount },
    (_, i) => [Math.abs(d.values[i]! - med), d.weights[i]!] as const,
  ).sort((a, b) => a[0] - b[0]);
  let cum = 0;
  const target = d.n / 2;
  for (const [dev, w] of pairs) {
    cum += w;
    if (cum >= target) return dev;
  }
  return pairs.length ? pairs[pairs.length - 1]![0] : NaN;
}

export function skewness(d: Distribution): number {
  if (d.distinctCount === 0 || d.n <= 0) return NaN; // empty / no observation mass
  const mu = mean(d);
  const m2 = centralMoment(d, 2, mu) / d.n;
  if (!(m2 > 0)) return 0;
  const m3 = centralMoment(d, 3, mu) / d.n;
  return m3 / Math.pow(m2, 1.5);
}

export function kurtosis(d: Distribution): number {
  if (d.distinctCount === 0 || d.n <= 0) return NaN; // empty / no observation mass
  const mu = mean(d);
  const m2 = centralMoment(d, 2, mu) / d.n;
  if (!(m2 > 0)) return 0;
  const m4 = centralMoment(d, 4, mu) / d.n;
  return m4 / (m2 * m2) - 3; // excess
}
