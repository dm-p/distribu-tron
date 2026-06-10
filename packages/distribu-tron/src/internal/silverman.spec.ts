import { describe, expect, it } from "vitest";
import { distribution } from "../distribution";
import { resolveBandwidth, scottBandwidth, silvermanBandwidth } from "./silverman";

describe("scottBandwidth", () => {
  it("is 1.06 * sd * n^(-1/5)", () => {
    expect(scottBandwidth(100, 2)).toBeCloseTo(1.06 * 2 * Math.pow(100, -0.2), 12);
  });
  it("equals silverman when stdev <= IQR/1.349 (silverman's robust term is inactive)", () => {
    // stdev 2 < iqr/1.349 (7.41) → silverman uses stdev too → identical
    expect(scottBandwidth(100, 2)).toBeCloseTo(silvermanBandwidth(100, 10, 2), 12);
  });
  it("differs from silverman when IQR/1.349 < stdev (robust term active)", () => {
    // iqr/1.349 = 1 < stdev 10 → silverman uses 1, scott uses 10
    expect(silvermanBandwidth(100, 1.349, 10)).not.toBeCloseTo(scottBandwidth(100, 10), 6);
  });
});

describe("resolveBandwidth", () => {
  const d = distribution([
    { value: 1, weight: 2 },
    { value: 2, weight: 5 },
    { value: 3, weight: 3 },
  ]);
  it("passes a numeric bandwidth through unchanged", () => {
    expect(resolveBandwidth(d, 1.5)).toBe(1.5);
  });
  it("maps 'silverman' and 'scott' to their respective rules", () => {
    expect(resolveBandwidth(d, "scott")).toBeGreaterThan(0);
    expect(resolveBandwidth(d, "silverman")).toBeGreaterThan(0);
    expect(resolveBandwidth(d, undefined)).toBe(resolveBandwidth(d, "silverman"));
  });
});
