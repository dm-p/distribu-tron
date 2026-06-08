import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { quantile, median, quartiles, percentileRank } from "./quantiles";

describe("quantile (linear default reduces to type-7 for unit weights)", () => {
  const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9]); // n=9
  it("median / quartiles", () => {
    expect(median(d)).toBe(5);
    expect(quartiles(d)).toEqual({ q1: 3, q2: 5, q3: 7, iqr: 4 });
  });
  it("linear interpolates between order stats", () => {
    const d2 = distribution([10, 20, 30, 40]); // n=4, type-7 median = 25
    expect(quantile(d2, 0.5)).toBeCloseTo(25, 12);
  });
  it("methods", () => {
    const d2 = distribution([10, 20, 30, 40]);
    expect(quantile(d2, 0.5, { method: "lower" })).toBe(20);
    expect(quantile(d2, 0.5, { method: "higher" })).toBe(30);
    expect(quantile(d2, 0.5, { method: "midpoint" })).toBe(25);
  });
  it("respects weights", () => {
    // value 1 weight 1, value 100 weight 99 → median pulled toward 100
    const dw = distribution([
      { value: 1, weight: 1 },
      { value: 100, weight: 99 },
    ]);
    expect(quantile(dw, 0.5, { method: "lower" })).toBe(100);
  });
  it("nearest rounds half away from zero", () => {
    const d2 = distribution([10, 20, 30, 40]); // h = 0.5*3 = 1.5 → round → 2 → 30
    expect(quantile(d2, 0.5, { method: "nearest" })).toBe(30);
  });
  it("boundary values p=0 and p=1", () => {
    const d2 = distribution([10, 20, 30, 40]);
    expect(quantile(d2, 0)).toBe(10);
    expect(quantile(d2, 1)).toBe(40);
    const dw = distribution([
      { value: 1, weight: 3 },
      { value: 9, weight: 7 },
    ]);
    expect(quantile(dw, 0)).toBe(1);
    expect(quantile(dw, 1)).toBe(9);
  });
  it("single distinct value short-circuits", () => {
    expect(quantile(distribution([42]), 0.5)).toBe(42);
  });
  it("linear default is weight-aware", () => {
    // n=100: value 1 weight 1, value 100 weight 99. median h=49.5 → both ranks land in heavy bucket → 100
    const dw = distribution([
      { value: 1, weight: 1 },
      { value: 100, weight: 99 },
    ]);
    expect(quantile(dw, 0.5)).toBe(100);
    // p=0.005 → h=0.495 → vLo=valueAtRank(0)=1, vHi=valueAtRank(1)=100 → 1 + 0.495*99 ≈ 50.005
    expect(quantile(dw, 0.005)).toBeCloseTo(50.005, 6);
  });
  it("empty / zero-mass → NaN (contract for boxplot/ecdf)", () => {
    const empty = distribution([]);
    expect(quantile(empty, 0.5)).toBeNaN();
    expect(median(empty)).toBeNaN();
    const { q1, q2, q3, iqr } = quartiles(empty);
    expect(q1).toBeNaN();
    expect(q2).toBeNaN();
    expect(q3).toBeNaN();
    expect(iqr).toBeNaN();
  });
  it("p outside [0,1] — including NaN — throws RangeError", () => {
    expect(() => quantile(d, 1.5)).toThrow(RangeError);
    expect(() => quantile(d, -0.1)).toThrow(RangeError);
    expect(() => quantile(d, NaN)).toThrow(RangeError);
  });
});

describe("percentileRank", () => {
  it("proportion of weight <= value", () => {
    const d = distribution([1, 2, 3, 4]); // n=4
    expect(percentileRank(d, 2)).toBeCloseTo(0.5, 12);
    expect(percentileRank(d, 4)).toBe(1);
    expect(percentileRank(d, 0)).toBe(0);
    expect(percentileRank(d, 1)).toBeCloseTo(0.25, 12); // exact minimum value
  });
  it("is weight-aware", () => {
    const dw = distribution([
      { value: 1, weight: 3 },
      { value: 10, weight: 7 },
    ]); // n=10
    expect(percentileRank(dw, 1)).toBeCloseTo(0.3, 12);
    expect(percentileRank(dw, 10)).toBe(1);
    expect(percentileRank(dw, 0)).toBe(0);
  });
  it("empty → NaN", () => {
    expect(percentileRank(distribution([]), 5)).toBeNaN();
  });
});
