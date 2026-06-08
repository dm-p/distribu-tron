import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { ecdf, cdf } from "./ecdf";

describe("ecdf / cdf", () => {
  it("step points reaching 1", () => {
    const d = distribution([1, 2, 3, 4]); // n=4
    expect(ecdf(d)).toEqual([
      { x: 1, p: 0.25 },
      { x: 2, p: 0.5 },
      { x: 3, p: 0.75 },
      { x: 4, p: 1 },
    ]);
  });
  it("cdf is the step value at x", () => {
    const d = distribution([1, 2, 3, 4]);
    expect(cdf(d, 2.5)).toBe(0.5);
    expect(cdf(d, 0)).toBe(0);
    expect(cdf(d, 99)).toBe(1);
  });
  it("empty → []", () => {
    expect(ecdf(distribution([]))).toEqual([]);
  });
  it("zero observation mass (all-zero weights) → []", () => {
    expect(
      ecdf(
        distribution([
          { value: 1, weight: 0 },
          { value: 2, weight: 0 },
        ]),
      ),
    ).toEqual([]);
  });
});
