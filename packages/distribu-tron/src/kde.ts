import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";

const ZERO = 1e-8;
const DEFAULT_RESOLUTION = 50;

/**
 * Robust Silverman rule-of-thumb bandwidth: `1.06 · min(stdev, IQR/1.349) · n^(-1/5)`.
 * The `n^(-1/5)` factor scales whichever spread estimate (stdev or the IQR-derived sigma) is smaller.
 */
export function silvermanBandwidth(n: number, iqr: number, stdev: number): number {
  return 1.06 * Math.min(iqr / 1.349, stdev) * Math.pow(n, -0.2);
}

/**
 * Windowed Epanechnikov kernel density estimate over the prepared distribution.
 * Returns `[]` for an empty/zero-mass distribution, and also when the resolved bandwidth is not
 * positive — which includes the degenerate single-value case (zero spread ⇒ silverman bandwidth 0).
 * Callers needing a curve for a (near-)degenerate distribution must pass an explicit numeric
 * `bandwidth`. `groupedKde` relies on the overall distribution being non-degenerate to seed shared
 * sample points.
 */
export function kde(d: Distribution, options: KdeOptions = {}): KdePoint[] {
  if (d.size === 0 || d.n <= 0) return [];
  const bandwidth = resolveBandwidth(d, options.bandwidth);
  if (!(bandwidth > 0)) return [];
  const clamp = options.clamp ?? false;
  const sample = options.samplePoints
    ? Array.from(options.samplePoints)
    : buildSamplePoints(d.min, d.max, options.resolution ?? DEFAULT_RESOLUTION, clamp);
  const pts: KdePoint[] = sample.map((x) => ({ x, density: density(d, x, bandwidth) }));
  if (options.samplePoints) return pts; // caller controls the grid exactly
  return clamp ? pts.filter((p) => p.x >= d.min && p.x <= d.max) : trimZeroTails(pts);
}

function resolveBandwidth(d: Distribution, bw: KdeOptions["bandwidth"]): number {
  if (typeof bw === "number") return bw;
  // "silverman" (default): needs IQR + population stdev
  const q = (p: number) => { const r = Math.max(0, Math.min(p * (d.n - 1), d.n - 1)); return d.values[idx(d, r)]!; };
  const iqr = q(0.75) - q(0.25);
  let sum = 0; for (let i = 0; i < d.size; i++) sum += d.values[i]! * d.weights[i]!;
  const mu = sum / d.n;
  let ss = 0; for (let i = 0; i < d.size; i++) { const x = d.values[i]! - mu; ss += d.weights[i]! * x * x; }
  const sd = Math.sqrt(Math.max(0, ss / d.n));
  return silvermanBandwidth(d.n, iqr, sd);
}

function buildSamplePoints(min: number, max: number, resolution: number, clamp: boolean): number[] {
  const sample = ticks(min, max, resolution);
  if (sample.length === 0) return [];
  const step = sample.length > 1 ? sample[1]! - sample[0]! : 0;
  if (clamp) {
    if (sample[0]! > min) sample.unshift(min);
    if (sample[sample.length - 1]! < max) sample.push(max);
  } else if (step > 0) {
    const buffer = Math.floor(resolution / 2);
    for (let i = 0; i < buffer; i++) { sample.unshift(sample[0]! - step); sample.push(sample[sample.length - 1]! + step); }
  }
  return sample;
}

function density(d: Distribution, x: number, h: number): number {
  const lo = lowerBound(d, x - h), hi = upperBound(d, x + h);
  let acc = 0;
  for (let i = lo; i < hi; i++) {
    const u = (x - d.values[i]!) / h;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / h : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return Math.abs(acc) < ZERO ? 0 : acc;
}

function lowerBound(d: Distribution, t: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.values[m]! < t) lo = m + 1; else hi = m; }
  return lo;
}
function upperBound(d: Distribution, t: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.values[m]! <= t) lo = m + 1; else hi = m; }
  return lo;
}
function idx(d: Distribution, r: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.cumulative[m]! <= r) lo = m + 1; else hi = m; }
  return Math.min(lo, d.size - 1);
}
function trimZeroTails(points: KdePoint[]): KdePoint[] {
  if (points.length === 0) return points;
  let s = 0;
  while (s < points.length - 1 && points[s]!.density === 0 && points[s + 1]!.density === 0) s++;
  let e = points.length - 1;
  while (e > s && points[e]!.density === 0 && points[e - 1]!.density === 0) e--;
  return points.slice(s, e + 1);
}
