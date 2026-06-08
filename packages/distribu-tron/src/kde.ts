import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";
import { silvermanFor } from "./internal/silverman";

export { silvermanBandwidth } from "./internal/silverman";

const ZERO = 1e-8;
const DEFAULT_RESOLUTION = 50;

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
  // A numeric bandwidth passes through; "silverman" (the default) is derived from the shared helper,
  // which uses the canonical interpolated IQR + weighted population stdev.
  return typeof bw === "number" ? bw : silvermanFor(d);
}

function buildSamplePoints(min: number, max: number, resolution: number, clamp: boolean): number[] {
  const sample = ticks(min, max, resolution);
  if (sample.length === 0) return [];
  const step = sample.length > 1 ? sample[1]! - sample[0]! : 0;
  if (clamp) {
    // Anchor the grid ends to exactly [min, max].
    if (sample[0]! > min) sample.unshift(min);
    if (sample[sample.length - 1]! < max) sample.push(max);
  } else if (step > 0) {
    // Pad buffer steps onto each end so the kernel can taper to zero beyond the data range.
    const buffer = Math.floor(resolution / 2);
    for (let i = 0; i < buffer; i++) {
      sample.unshift(sample[0]! - step);
      sample.push(sample[sample.length - 1]! + step);
    }
  }
  return sample;
}

function density(d: Distribution, x: number, h: number): number {
  const lo = lowerBound(d, x - h),
    hi = upperBound(d, x + h);
  let acc = 0;
  for (let i = lo; i < hi; i++) {
    const u = (x - d.values[i]!) / h;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / h : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return Math.abs(acc) < ZERO ? 0 : acc;
}

function lowerBound(d: Distribution, t: number): number {
  let lo = 0,
    hi = d.size;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (d.values[m]! < t) lo = m + 1;
    else hi = m;
  }
  return lo;
}
function upperBound(d: Distribution, t: number): number {
  let lo = 0,
    hi = d.size;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (d.values[m]! <= t) lo = m + 1;
    else hi = m;
  }
  return lo;
}
function trimZeroTails(points: KdePoint[]): KdePoint[] {
  if (points.length === 0) return points;
  let s = 0;
  while (s < points.length - 1 && points[s]!.density === 0 && points[s + 1]!.density === 0) s++;
  let e = points.length - 1;
  while (e > s && points[e]!.density === 0 && points[e - 1]!.density === 0) e--;
  return points.slice(s, e + 1);
}
