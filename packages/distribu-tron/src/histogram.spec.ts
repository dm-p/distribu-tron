import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { histogram, DEFAULT_MAX_AUTO_BINS } from "./histogram";
import type { Bin } from "./types";

const total = (b: Bin[]) => b.reduce((s, x) => s + x.weight, 0);
const skewed = distribution([
  ...Array.from({ length: 101 }, (_, i) => ({ value: i * 4, weight: 1 })),
  { value: 6000, weight: 1 },
]);

describe("histogram", () => {
  it("empty → []", () => {
    expect(histogram(distribution([]))).toEqual([]);
  });
  it("weights are conserved", () => {
    const d = distribution([
      { value: 1, weight: 2 },
      { value: 5, weight: 9 },
      { value: 9, weight: 4 },
    ]);
    expect(total(histogram(d))).toBe(15);
  });
  it("auto bin count is capped on skewed data", () => {
    const bins = histogram(skewed);
    expect(bins.length).toBeLessThanOrEqual(DEFAULT_MAX_AUTO_BINS);
    expect(bins.length).toBeGreaterThan(1);
    expect(total(bins)).toBe(skewed.n);
  });
  it("explicit edges override the rule", () => {
    const d = distribution([1, 5, 9]);
    const bins = histogram(d, { edges: [0, 5, 10] });
    expect(bins.map((b) => [b.x0, b.x1])).toEqual([
      [0, 5],
      [5, 10],
    ]);
    expect(total(bins)).toBe(3);
  });
  it("single distinct value → one bin holding all weight", () => {
    const bins = histogram(distribution([{ value: 7, weight: 4 }]));
    expect(bins).toEqual([{ x0: 7, x1: 7, weight: 4 }]);
  });
  it("binCount steers the target bin count (approximately)", () => {
    const d = distribution(Array.from({ length: 100 }, (_, i) => i)); // 0..99
    const few = histogram(d, { binCount: 4 });
    const many = histogram(d, { binCount: 40 });
    expect(many.length).toBeGreaterThan(few.length);
    expect(total(few)).toBe(d.n);
    expect(total(many)).toBe(d.n);
  });
  it("maxBins caps the auto rule", () => {
    const bins = histogram(skewed, { maxBins: 5 });
    expect(bins.length).toBeLessThanOrEqual(5);
    expect(total(bins)).toBe(skewed.n);
  });
  it("negative domain conserves weight", () => {
    const d = distribution([
      { value: -50, weight: 2 },
      { value: -10, weight: 3 },
      { value: -1, weight: 5 },
    ]);
    expect(total(histogram(d))).toBe(10);
  });
  it("values outside explicit edges clamp into boundary bins (weight conserved)", () => {
    const d = distribution([-5, 2, 8, 99]);
    const bins = histogram(d, { edges: [0, 5, 10] });
    // -5 absorbed into first bin, 99 absorbed into last; total weight preserved
    expect(total(bins)).toBe(d.n);
    expect(bins[0]!.weight).toBe(2); // -5 and 2
    expect(bins[1]!.weight).toBe(2); // 8 and 99
  });
});
