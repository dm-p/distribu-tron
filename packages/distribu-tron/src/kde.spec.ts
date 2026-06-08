import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { kde, silvermanBandwidth } from "./kde";

const d = distribution([
  { value: 1, weight: 2 }, { value: 2, weight: 5 }, { value: 3, weight: 9 },
  { value: 4, weight: 7 }, { value: 5, weight: 4 }, { value: 6, weight: 2 }, { value: 7, weight: 1 },
]);

function naive(x: number, h: number): number {
  let acc = 0;
  for (let i = 0; i < d.size; i++) {
    const u = (x - d.values[i]!) / h;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / h : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return acc;
}

describe("kde", () => {
  it("empty → []", () => { expect(kde(distribution([]), {})).toEqual([]); });
  it("windowed == naive at every returned point", () => {
    const pts = kde(d, { bandwidth: 1.5, clamp: false, resolution: 50 });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeCloseTo(naive(p.x, 1.5), 6);
  });
  it("never negative", () => {
    for (const p of kde(d, { bandwidth: 1.5 })) expect(p.density).toBeGreaterThanOrEqual(0);
  });
  it("explicit samplePoints are honored", () => {
    const pts = kde(d, { bandwidth: 1.5, samplePoints: [2, 4] });
    expect(pts.map((p) => p.x)).toEqual([2, 4]);
  });
  it("silverman scales the IQR estimate by n^-1/5 when it is smaller", () => {
    // iqr/1.349 = 1 < stdev 10 → 1.06 * 1 * n^-0.2
    expect(silvermanBandwidth(100, 1.349, 10)).toBeCloseTo(1.06 * Math.pow(100, -0.2), 10);
  });
  it("silverman scales the stdev estimate by n^-1/5 when it is smaller", () => {
    // stdev 0.3 < iqr/1.349 (7.41) → 1.06 * 0.3 * n^-0.2  (regression guard: n^-0.2 must apply to stdev)
    expect(silvermanBandwidth(100, 10, 0.3)).toBeCloseTo(1.06 * 0.3 * Math.pow(100, -0.2), 12);
  });
  it("silverman falls back to stdev when IQR is 0", () => {
    // a heavily-tied distribution (IQR=0) must not collapse the bandwidth to 0
    expect(silvermanBandwidth(100, 0, 2)).toBeCloseTo(1.06 * 2 * Math.pow(100, -0.2), 12);
  });
  it("peaked-but-spread distribution (IQR=0, stdev>0) still produces a curve", () => {
    // ~50% of mass on the middle value → interpolated/step IQR is 0, but there is real spread
    const peaked = distribution([{ value: 1, weight: 1 }, { value: 2, weight: 100 }, { value: 3, weight: 1 }]);
    const pts = kde(peaked); // default silverman
    expect(pts.length).toBeGreaterThan(0);
  });
  it("silverman default path produces a usable curve (no explicit bandwidth)", () => {
    const pts = kde(d); // bandwidth defaults to silverman
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeGreaterThanOrEqual(0);
  });
  it("clamp keeps sample points within [min, max]", () => {
    const pts = kde(d, { bandwidth: 1.5, clamp: true });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(d.min);
      expect(p.x).toBeLessThanOrEqual(d.max);
    }
  });
  it("single-value distribution → [] (zero spread ⇒ zero bandwidth)", () => {
    expect(kde(distribution([{ value: 5, weight: 10 }]))).toEqual([]);
  });
});
