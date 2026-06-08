import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import {
  mean,
  sum,
  min,
  max,
  range,
  variance,
  stdev,
  mode,
  mad,
  skewness,
  kurtosis,
  weightedMedianSorted,
} from "./descriptives";

const d = distribution([
  { value: 1, weight: 3 },
  { value: 2, weight: 2 },
  { value: 3, weight: 1 },
]);

describe("descriptives basics", () => {
  it("sum / mean over the weighted population", () => {
    expect(sum(d)).toBe(10); // 1*3 + 2*2 + 3*1
    expect(mean(d)).toBeCloseTo(10 / 6, 12);
  });
  it("min / max / range", () => {
    expect(min(d)).toBe(1);
    expect(max(d)).toBe(3);
    expect(range(d)).toBe(2);
  });
  it("empty → NaN-ish", () => {
    const e = distribution([]);
    expect(Number.isNaN(mean(e))).toBe(true);
    expect(min(e)).toBe(Infinity);
  });
});

describe("variance / stdev", () => {
  it("population by default (÷n)", () => {
    // values 2,4,4,4,5,5,7,9 (n=8): population variance 4, stdev 2
    const d = distribution([
      { value: 2, weight: 1 },
      { value: 4, weight: 3 },
      { value: 5, weight: 2 },
      { value: 7, weight: 1 },
      { value: 9, weight: 1 },
    ]);
    expect(variance(d)).toBeCloseTo(4, 10);
    expect(stdev(d)).toBeCloseTo(2, 10);
  });
  it("sample uses n-1", () => {
    const d = distribution([
      { value: 0, weight: 1 },
      { value: 10, weight: 1 },
    ]);
    expect(variance(d, { sample: true })).toBeCloseTo(50, 10); // ((0-5)^2+(10-5)^2)/(2-1)
  });
  it("degenerate → 0", () => {
    expect(stdev(distribution([{ value: 7, weight: 5 }]))).toBe(0);
  });
  it("zero observation mass (all-zero weights) → NaN, consistent with mean", () => {
    const z = distribution([
      { value: 1, weight: 0 },
      { value: 2, weight: 0 },
    ]);
    expect(Number.isNaN(mean(z))).toBe(true);
    expect(Number.isNaN(variance(z))).toBe(true);
    expect(Number.isNaN(stdev(z))).toBe(true);
    expect(Number.isNaN(skewness(z))).toBe(true);
    expect(Number.isNaN(kurtosis(z))).toBe(true);
  });
  it("sample variance of a single observation is undefined (NaN)", () => {
    const one = distribution([{ value: 7, weight: 1 }]); // n=1
    expect(Number.isNaN(variance(one, { sample: true }))).toBe(true);
    expect(Number.isNaN(stdev(one, { sample: true }))).toBe(true);
    expect(variance(one)).toBe(0); // population variance of one point is still 0
  });
});

describe("mode/mad/skewness/kurtosis", () => {
  it("mode = max-weight value (ties → smallest)", () => {
    expect(
      mode(
        distribution([
          { value: 5, weight: 2 },
          { value: 8, weight: 9 },
          { value: 9, weight: 9 },
        ]),
      ),
    ).toBe(8);
  });
  it("mad = weighted median of |x - median|", () => {
    // values 1,2,3,4,5 each weight 1: median 3, deviations 2,1,0,1,2 → median 1
    const d = distribution([1, 2, 3, 4, 5]);
    expect(mad(d)).toBe(1);
  });
  it("symmetric data → ~0 skew", () => {
    const d = distribution([1, 2, 3, 4, 5]);
    expect(skewness(d)).toBeCloseTo(0, 12);
  });
  it("right-skewed data → positive skew (sign check)", () => {
    // mass piled at the low end, tail to the right
    const d = distribution([
      { value: 1, weight: 4 },
      { value: 2, weight: 2 },
      { value: 3, weight: 1 },
    ]);
    expect(skewness(d)).toBeGreaterThan(0);
  });
  it("excess kurtosis of all-equal → 0 (degenerate)", () => {
    expect(kurtosis(distribution([{ value: 4, weight: 10 }]))).toBe(0);
  });
  it("empty → NaN for mode/mad/skewness/kurtosis", () => {
    const e = distribution([]);
    expect(Number.isNaN(mode(e))).toBe(true);
    expect(Number.isNaN(mad(e))).toBe(true);
    expect(Number.isNaN(skewness(e))).toBe(true);
    expect(Number.isNaN(kurtosis(e))).toBe(true);
  });
});

describe("weightedMedianSorted (lower-median helper)", () => {
  it("returns the first value reaching half the total weight", () => {
    // cumulative [1,2,3,4]; n=4; target 2 → values[1] = 20
    expect(weightedMedianSorted([10, 20, 30, 40], [1, 2, 3, 4], 4)).toBe(20);
  });
  it("respects weight (pull toward heavy value)", () => {
    // value 1 weight 1, value 100 weight 99; cumulative [1,100]; n=100; target 50 → 100
    expect(weightedMedianSorted([1, 100], [1, 100], 100)).toBe(100);
  });
  it("empty / zero-n → NaN", () => {
    expect(Number.isNaN(weightedMedianSorted([], [], 0))).toBe(true);
  });
});
