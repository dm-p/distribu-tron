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
  readonly distinctCount: number; // count of DISTINCT values
  readonly n: number;
  readonly min: number;
  readonly max: number;
  readonly values: Float64Array;
  readonly weights: Float64Array;
  readonly cumulativeWeights: Float64Array; // inclusive running Σ weight; cumulativeWeights[i] = Σ_{j<=i} weights[j]
  readonly timings?: PrepTimings;
}

export type QuantileMethod = "linear" | "lower" | "higher" | "nearest" | "midpoint";

export interface SummaryStatistics {
  n: number;
  distinctCount: number;
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

export type KdeKernel = "gaussian" | "epanechnikov" | "triangular" | "cosine";

export interface KdeOptions {
  /** Numeric bandwidth = the kernel standard deviation. Defaults to "silverman". */
  bandwidth?: number | "silverman" | "scott";
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  /** Smoothing kernel. Defaults to "gaussian". */
  kernel?: KdeKernel;
}

// --- grouping ---
export type GroupKeyValue = string | number | null;
export type Accessor<T> = string | ((row: Record<string, unknown>) => T);

export interface GroupSpec {
  by: string | string[];
  value: Accessor<number>;
  weight?: Accessor<number>;
  rollup?: boolean | "prefix" | "margins" | "cube";
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
