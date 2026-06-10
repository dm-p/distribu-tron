import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";
import { type Kernel, resolveKernel } from "./internal/kernels";
import { resolveBandwidth } from "./internal/silverman";

export { silvermanBandwidth, scottBandwidth } from "./internal/silverman";

const ZERO = 1e-8;
const DEFAULT_RESOLUTION = 50;

/**
 * Windowed kernel density estimate over the prepared distribution. The kernel defaults to Gaussian
 * (`options.kernel` selects "gaussian" | "epanechnikov" | "triangular" | "cosine"); `bandwidth` is the
 * kernel standard deviation, defaulting to the Silverman rule ("scott" is also available).
 * Returns `[]` for an empty/zero-mass distribution, and also when the resolved bandwidth is not
 * positive — which includes the degenerate single-value case (zero spread ⇒ silverman bandwidth 0).
 * Callers needing a curve for a (near-)degenerate distribution must pass an explicit numeric
 * `bandwidth`. `groupedKde` relies on the overall distribution being non-degenerate to seed shared
 * sample points.
 */
export function kde(d: Distribution, options: KdeOptions = {}): KdePoint[] {
  if (d.distinctCount === 0 || d.n <= 0) return [];
  const bandwidth = resolveBandwidth(d, options.bandwidth);
  if (!(bandwidth > 0)) return [];
  const kernel = resolveKernel(options.kernel);
  const clamp = options.clamp ?? false;
  const sample = options.samplePoints
    ? Array.from(options.samplePoints)
    : buildSamplePoints(d.min, d.max, options.resolution ?? DEFAULT_RESOLUTION, clamp);
  const pts: KdePoint[] = sample.map((x) => ({ x, density: density(d, x, bandwidth, kernel) }));
  if (options.samplePoints) return pts; // caller controls the grid exactly
  return clamp ? pts.filter((p) => p.x >= d.min && p.x <= d.max) : trimZeroTails(pts);
}

function buildSamplePoints(min: number, max: number, resolution: number, clamp: boolean): number[] {
  const sample = ticks(min, max, resolution);
  if (sample.length === 0) return [];
  const step = sample.length > 1 ? sample[1]! - sample[0]! : 0;
  if (clamp) {
    // Anchor the grid ends to exactly [min, max].
    if (sample[0]! > min) sample.unshift(min);
    if (sample[sample.length - 1]! < max) sample.push(max);
    return sample;
  }
  if (!(step > 0)) return sample;
  // Pad `buffer` steps onto each end so the kernel can taper to zero beyond the data range.
  // Built in one O(n) pass — a repeated unshift() would be O(n²) for large resolutions.
  const buffer = Math.floor(resolution / 2);
  const first = sample[0]!;
  const last = sample[sample.length - 1]!;
  const out: number[] = [];
  for (let i = buffer; i >= 1; i--) out.push(first - i * step);
  for (const x of sample) out.push(x);
  for (let i = 1; i <= buffer; i++) out.push(last + i * step);
  return out;
}

function density(d: Distribution, x: number, bandwidth: number, kernel: Kernel): number {
  const a = bandwidth * kernel.sdScale; // native scale
  const w = bandwidth * kernel.radius; // window half-width in x units
  const lo = lowerBound(d, x - w);
  const hi = upperBound(d, x + w);
  let acc = 0;
  for (let i = lo; i < hi; i++) {
    acc += (d.weights[i]! / d.n) * (kernel.k((x - d.values[i]!) / a) / a);
  }
  return Math.abs(acc) < ZERO ? 0 : acc;
}

function lowerBound(d: Distribution, t: number): number {
  let lo = 0,
    hi = d.distinctCount;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (d.values[m]! < t) lo = m + 1;
    else hi = m;
  }
  return lo;
}
function upperBound(d: Distribution, t: number): number {
  let lo = 0,
    hi = d.distinctCount;
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
