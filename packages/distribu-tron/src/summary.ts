import type { Distribution, SummaryStatistics } from "./types";
import { mean, stdev, range, mode, mad, skewness, kurtosis } from "./descriptives";
import { quartiles } from "./quantiles";

export function summary(d: Distribution): SummaryStatistics {
  const { q1, q2, q3, iqr } = quartiles(d);
  return {
    n: d.n,
    distinctCount: d.distinctCount,
    mean: mean(d),
    stdev: stdev(d),
    min: d.min,
    max: d.max,
    range: range(d),
    mode: mode(d),
    mad: mad(d),
    skewness: skewness(d),
    kurtosis: kurtosis(d),
    q1,
    median: q2,
    q3,
    iqr,
  };
}
