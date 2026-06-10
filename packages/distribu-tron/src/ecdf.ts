import type { Distribution, EcdfPoint } from "./types";
import { percentileRank } from "./quantiles";

export function ecdf(d: Distribution): EcdfPoint[] {
  if (d.distinctCount === 0 || d.n <= 0) return []; // empty / zero-mass: no defined cumulative probabilities
  const out: EcdfPoint[] = new Array(d.distinctCount);
  for (let i = 0; i < d.distinctCount; i++) out[i] = { x: d.values[i]!, p: d.cumulativeWeights[i]! / d.n };
  return out;
}

export function cdf(d: Distribution, value: number): number {
  return percentileRank(d, value);
}
