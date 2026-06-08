import type { BoxplotResult, Distribution } from "./types";
import { quartiles } from "./quantiles";

export function boxplot(d: Distribution, opts: { whisker?: number } = {}): BoxplotResult {
  const k = opts.whisker ?? 1.5;
  const { q1, q2, q3, iqr } = quartiles(d);
  const lowerFence = q1 - k * iqr;
  const upperFence = q3 + k * iqr;
  const outliers: number[] = [];
  // values are ascending, so the first in-fence value is the lower whisker end and the last is the upper.
  let lowerAdjacent = NaN;
  let upperAdjacent = NaN;
  for (let i = 0; i < d.size; i++) {
    if (d.weights[i]! === 0) continue; // zero-weight values carry no mass — not observations
    const v = d.values[i]!;
    if (v < lowerFence || v > upperFence) {
      outliers.push(v);
    } else {
      if (Number.isNaN(lowerAdjacent)) lowerAdjacent = v;
      upperAdjacent = v;
    }
  }
  return {
    min: d.min,
    q1,
    median: q2,
    q3,
    max: d.max,
    iqr,
    lowerFence,
    upperFence,
    lowerAdjacent,
    upperAdjacent,
    outliers,
  };
}
