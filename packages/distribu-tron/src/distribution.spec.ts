import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";

describe("distribution", () => {
  it("builds from a frequency table (sorted, distinct, cumulative)", () => {
    const d = distribution([
      { value: 3, weight: 1 },
      { value: 1, weight: 2 },
      { value: 2, weight: 5 },
    ]);
    expect(Array.from(d.values)).toEqual([1, 2, 3]);
    expect(Array.from(d.weights)).toEqual([2, 5, 1]);
    expect(Array.from(d.cumulative)).toEqual([2, 7, 8]);
    expect(d.n).toBe(8);
    expect(d.size).toBe(3);
    expect(d.min).toBe(1);
    expect(d.max).toBe(3);
  });
  it("aggregates raw number[] (weight 1 each, merged)", () => {
    const d = distribution([5, 1, 5, 5, 1]);
    expect(Array.from(d.values)).toEqual([1, 5]);
    expect(Array.from(d.weights)).toEqual([2, 3]);
  });
  it("accepts columnar / TypedArray", () => {
    const d = distribution({ values: Float64Array.from([10, 20]), weights: Float64Array.from([3, 4]) });
    expect(Array.from(d.values)).toEqual([10, 20]);
    expect(d.n).toBe(7);
  });
  it("merges duplicate values in a table", () => {
    const d = distribution([
      { value: 1, weight: 2 },
      { value: 1, weight: 3 },
    ]);
    expect(Array.from(d.values)).toEqual([1]);
    expect(Array.from(d.weights)).toEqual([5]);
  });
  it("sorted:true trusts order and skips aggregation", () => {
    const d = distribution(
      [
        { value: 1, weight: 2 },
        { value: 2, weight: 3 },
      ],
      { sorted: true },
    );
    expect(Array.from(d.values)).toEqual([1, 2]);
  });
  it("rejects negative / non-finite", () => {
    expect(() => distribution([{ value: 1, weight: -1 }])).toThrow(RangeError);
    expect(() => distribution([{ value: NaN, weight: 1 }])).toThrow(RangeError);
  });
  it("columnar without weights infers unit weight", () => {
    const d = distribution({ values: [10, 20, 20] });
    expect(Array.from(d.values)).toEqual([10, 20]);
    expect(Array.from(d.weights)).toEqual([1, 2]);
    expect(d.n).toBe(3);
  });
  it("rejects columnar values/weights length mismatch", () => {
    expect(() => distribution({ values: [1, 2], weights: [10, 20, 30] })).toThrow(RangeError);
    expect(() => distribution({ values: [1, 2, 3], weights: [10, 20] })).toThrow(RangeError);
  });
  it("permits zero weights (flat cumulative step)", () => {
    const d = distribution([
      { value: 1, weight: 0 },
      { value: 2, weight: 5 },
    ]);
    expect(Array.from(d.cumulative)).toEqual([0, 5]);
    expect(d.n).toBe(5);
  });
  it("empty distribution is valid", () => {
    const d = distribution([]);
    expect(d.size).toBe(0);
    expect(d.n).toBe(0);
    expect(d.min).toBe(Infinity);
    expect(d.max).toBe(-Infinity);
  });
  it("profile attaches prep timings when asked", () => {
    const d = distribution([3, 1, 2], { profile: true });
    expect(d.timings?.totalMs).toBeGreaterThanOrEqual(0);
    expect(distribution([1]).timings).toBeUndefined();
  });
});
