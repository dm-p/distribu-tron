import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { kde, silvermanBandwidth } from "./kde";

const d = distribution([
  { value: 1, weight: 2 },
  { value: 2, weight: 5 },
  { value: 3, weight: 9 },
  { value: 4, weight: 7 },
  { value: 5, weight: 4 },
  { value: 6, weight: 2 },
  { value: 7, weight: 1 },
]);

// Epanechnikov reference under SD-scale bandwidth: native half-width a = h * sqrt(5).
function naiveEpanechnikov(x: number, h: number): number {
  const a = h * Math.sqrt(5);
  let acc = 0;
  for (let i = 0; i < d.size; i++) {
    const u = (x - d.values[i]!) / a;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / a : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return acc;
}

describe("kde", () => {
  it("empty → []", () => {
    expect(kde(distribution([]), {})).toEqual([]);
  });
  it("windowed epanechnikov == naive at every returned point", () => {
    const pts = kde(d, { bandwidth: 1.5, kernel: "epanechnikov", clamp: false, resolution: 50 });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeCloseTo(naiveEpanechnikov(p.x, 1.5), 6);
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
    const peaked = distribution([
      { value: 1, weight: 1 },
      { value: 2, weight: 100 },
      { value: 3, weight: 1 },
    ]);
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

  it("defaults to the gaussian kernel", () => {
    const def = kde(d, { bandwidth: 1.5, samplePoints: [3.5] })[0]!.density;
    const gauss = kde(d, { bandwidth: 1.5, kernel: "gaussian", samplePoints: [3.5] })[0]!.density;
    const epan = kde(d, { bandwidth: 1.5, kernel: "epanechnikov", samplePoints: [3.5] })[0]!.density;
    expect(def).toBeCloseTo(gauss, 12);
    expect(def).not.toBeCloseTo(epan, 6);
  });

  it("gaussian default is smooth on a coarse-bandwidth dataset (few extrema)", () => {
    const exam = distribution([
      { value: 0, weight: 8 },
      { value: 4, weight: 19 },
      { value: 8, weight: 34 },
      { value: 12, weight: 49 },
      { value: 16, weight: 58 },
      { value: 20, weight: 52 },
      { value: 24, weight: 40 },
      { value: 28, weight: 27 },
      { value: 32, weight: 16 },
      { value: 36, weight: 8 },
      { value: 40, weight: 4 },
    ]);
    const pts = kde(exam, { bandwidth: 6 });
    let extrema = 0;
    let prev = 0;
    for (let i = 1; i < pts.length; i++) {
      const s = Math.sign(pts[i]!.density - pts[i - 1]!.density);
      if (s !== 0 && prev !== 0 && s !== prev) extrema++;
      if (s !== 0) prev = s;
    }
    expect(extrema).toBeLessThanOrEqual(3);
  });

  it("the same bandwidth gives comparable spread across kernels (SD-normalized)", () => {
    const spread = (kernel: "gaussian" | "epanechnikov" | "triangular" | "cosine") => {
      const pts = kde(d, { bandwidth: 1.2, kernel, resolution: 200 });
      const tot = pts.reduce((s, p) => s + p.density, 0);
      const mean = pts.reduce((s, p) => s + p.x * p.density, 0) / tot;
      const varr = pts.reduce((s, p) => s + (p.x - mean) ** 2 * p.density, 0) / tot;
      return Math.sqrt(varr);
    };
    const g = spread("gaussian");
    for (const k of ["epanechnikov", "triangular", "cosine"] as const) {
      expect(spread(k)).toBeCloseTo(g, 1);
    }
  });

  it("gaussian truncation at 4σ conserves ~all of the density mass", () => {
    const pts = kde(d, { bandwidth: 1.0, kernel: "gaussian", resolution: 400 });
    let area = 0;
    for (let i = 1; i < pts.length; i++) {
      area += ((pts[i]!.density + pts[i - 1]!.density) / 2) * (pts[i]!.x - pts[i - 1]!.x);
    }
    expect(area).toBeCloseTo(1, 2);
  });

  it("bandwidth: 'scott' produces a usable curve", () => {
    const pts = kde(d, { bandwidth: "scott" });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeGreaterThanOrEqual(0);
  });
});
