import type { Bin, Distribution, HistogramOptions } from "./types";
import { quantile } from "./quantiles";
import { stdev } from "./descriptives";

export const DEFAULT_MAX_AUTO_BINS = 50;

/**
 * Weighted histogram over the prepared distribution. Bins are right-open (`[x0, x1)`) except the
 * final bin, which is closed so `d.max` lands in it. Total bin weight equals `d.n`.
 *
 * Binning:
 * - `options.edges` (length ≥ 2): used verbatim (sorted). The only rule supported, `"fd"`, is the
 *   default — `options.rule` is accepted for forward-compat but has no other value.
 * - otherwise a capped Freedman–Diaconis count (Scott fallback when IQR=0) with `niceStep` rounding.
 * - `binCount`/`maxBins` are **approximate** targets: `niceStep` rounding and domain expansion to nice
 *   boundaries can shift the final bin count up or down from the request.
 *
 * Contract for explicit `edges`: they should span the full data domain. Values below `edges[0]` fall
 * into the first bin and values above the last edge into the last bin (weight is still conserved, but
 * those bins' `x0`/`x1` won't describe the absorbed values). `groupedHistogram` (Task 18) satisfies
 * this by deriving shared edges from the overall distribution, which spans every group's domain.
 */
export function histogram(d: Distribution, options: HistogramOptions = {}): Bin[] {
  if (d.distinctCount === 0) return [];
  if (d.min === d.max) return [{ x0: d.min, x1: d.max, weight: d.n }];
  const boundaries =
    options.edges && options.edges.length >= 2
      ? options.edges.slice().sort((a, b) => a - b)
      : computeBoundaries(d, options);
  const bins: Bin[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) bins.push({ x0: boundaries[i]!, x1: boundaries[i + 1]!, weight: 0 });
  if (bins.length === 0) return [{ x0: d.min, x1: d.max, weight: d.n }];
  assign(d, bins);
  return bins;
}

function computeBoundaries(d: Distribution, options: HistogramOptions): number[] {
  const target =
    options.binCount && options.binCount > 0
      ? options.binCount
      : autoBinCount(d, options.maxBins ?? DEFAULT_MAX_AUTO_BINS);
  const step = niceStep((d.max - d.min) / target);
  if (!(step > 0)) return [d.min, d.max];
  const start = Math.floor(d.min / step) * step;
  const end = Math.ceil(d.max / step) * step;
  const segments = Math.max(1, Math.round((end - start) / step));
  const out: number[] = new Array(segments + 1);
  for (let i = 0; i <= segments; i++) out[i] = start + i * step;
  return out;
}

function autoBinCount(d: Distribution, cap: number): number {
  // Freedman–Diaconis on the distinct-value count, Scott fallback when IQR is 0.
  // Uses the canonical interpolated IQR + weighted population stdev so the rule agrees with the
  // public quartiles()/stdev() a caller would compute by hand.
  const iqrVal = quantile(d, 0.75) - quantile(d, 0.25);
  const sd = stdev(d);
  let width: number;
  if (d.distinctCount > 1 && iqrVal > 0) width = (2 * iqrVal) / Math.cbrt(d.distinctCount);
  else if (d.distinctCount > 1 && sd > 0) width = (3.5 * sd) / Math.cbrt(d.distinctCount);
  else width = 1;
  const count = Math.max(1, Math.ceil((d.max - d.min) / width));
  return Math.min(count, Math.max(1, cap));
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function assign(d: Distribution, bins: Bin[]): void {
  const last = bins.length - 1;
  let b = 0;
  for (let i = 0; i < d.distinctCount; i++) {
    const v = d.values[i]!;
    while (b < last && v >= bins[b]!.x1) b++;
    bins[b]!.weight += d.weights[i]!;
  }
}
