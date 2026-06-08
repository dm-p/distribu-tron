export interface WeightedValue {
  value: number;
  weight: number;
}

export type DistributionInput = WeightedValue[] | number[] | { values: ArrayLike<number>; weights?: ArrayLike<number> };

export interface DistributionOptions {
  sorted?: boolean;
  profile?: boolean;
}

export interface PrepTimings {
  validateMs: number;
  aggregateMs: number;
  sortMs: number;
  totalMs: number;
}

export interface Distribution {
  readonly size: number;
  readonly n: number;
  readonly min: number;
  readonly max: number;
  readonly values: Float64Array;
  readonly weights: Float64Array;
  readonly cumulative: Float64Array; // running Σ weight; cumulative[i] = Σ_{j<=i} weights[j]
  readonly timings?: PrepTimings;
}

export type QuantileMethod = "linear" | "lower" | "higher" | "nearest" | "midpoint";

export interface SummaryStatistics {
  n: number;
  size: number;
  mean: number;
  stdev: number;
  min: number;
  max: number;
  range: number;
  mode: number;
  mad: number;
  skewness: number;
  kurtosis: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
}

export interface Bin {
  x0: number;
  x1: number;
  weight: number;
}
export interface KdePoint {
  x: number;
  density: number;
}
export interface EcdfPoint {
  x: number;
  p: number;
}

export interface BoxplotResult {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  /** Lowest value at or above `lowerFence` — the lower whisker end (NaN if empty). */
  lowerAdjacent: number;
  /** Highest value at or below `upperFence` — the upper whisker end (NaN if empty). */
  upperAdjacent: number;
  outliers: number[];
}

export interface HistogramOptions {
  binCount?: number;
  maxBins?: number;
  rule?: "fd";
  edges?: number[];
}

export interface KdeOptions {
  bandwidth?: number | "silverman";
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  kernel?: "epanechnikov";
}

// --- grouping ---
export type GroupKeyValue = string | number | null;
export type Accessor<T> = string | ((row: Record<string, unknown>) => T);

export interface GroupSpec {
  by: string | string[];
  value: Accessor<number>;
  weight?: Accessor<number>;
  rollup?: boolean;
  totalLabel?: string | null;
  sorted?: boolean;
}

export interface DistributionGroup {
  readonly key: Record<string, GroupKeyValue>;
  readonly level: string[]; // dimensions active (not rolled up)
  readonly depth: number; // level.length
  readonly distribution: Distribution;
}

export interface GroupedDistribution {
  readonly dimensions: string[];
  readonly groups: DistributionGroup[];
  readonly leaves: DistributionGroup[];
  readonly overall: Distribution;
}

/** Which rollup levels a grouped consumer (summarize/groupedHistogram/groupedKde) should emit. */
export interface LevelSelect {
  includeSubtotals?: boolean;
  includeOverall?: boolean;
}
