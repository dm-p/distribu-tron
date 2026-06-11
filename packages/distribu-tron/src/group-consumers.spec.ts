import { describe, it, expect } from "vitest";
import { group, summarize, groupedHistogram, groupedKde } from "./group";
import { scottBandwidth } from "./kde";
import { stdev } from "./descriptives";

const rows = [
  { cat: "A", value: 1, weight: 10 },
  { cat: "A", value: 5, weight: 10 },
  { cat: "B", value: 1, weight: 10 },
  { cat: "B", value: 9, weight: 10 },
];

describe("grouped consumers", () => {
  it("summarize tags rows with key + depth", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const s = summarize(gd);
    expect(s.length).toBe(2);
    expect(s[0]).toHaveProperty("cat");
    expect(s[0]).toHaveProperty("depth", 1);
    expect(s[0]).toHaveProperty("median");
  });
  it("groupedHistogram shares identical edges across groups, leaves only by default", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const bins = groupedHistogram(gd);
    const aEdges = bins.filter((b) => b.cat === "A").map((b) => `${b.x0}:${b.x1}`);
    const bEdges = bins.filter((b) => b.cat === "B").map((b) => `${b.x0}:${b.x1}`);
    expect(aEdges).toEqual(bEdges); // shared domain
    expect(bins.every((b) => b.depth === 1)).toBe(true); // leaves only
  });
  it("includeOverall adds the grand-total series", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    const bins = groupedHistogram(gd, { includeOverall: true });
    expect(bins.some((b) => b.depth === 0)).toBe(true);
  });
  it("groupedKde shares sample points across groups", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const pts = groupedKde(gd, { bandwidth: 1.5 });
    const ax = pts.filter((p) => p.cat === "A").map((p) => p.x);
    const bx = pts.filter((p) => p.cat === "B").map((p) => p.x);
    expect(ax).toEqual(bx);
  });
  it("groupedKde derives a shared silverman bandwidth when none is given", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const pts = groupedKde(gd); // no explicit bandwidth → silvermanFor(overall)
    expect(pts.length).toBeGreaterThan(0);
    const ax = pts.filter((p) => p.cat === "A").map((p) => p.x);
    const bx = pts.filter((p) => p.cat === "B").map((p) => p.x);
    expect(ax).toEqual(bx); // still a shared grid
    for (const p of pts) expect(p.density).toBeGreaterThanOrEqual(0);
  });
  it("throws when a grouping dimension collides with an output field name", () => {
    // dimension named "weight" would overwrite a histogram bin's weight — fail fast instead
    const collide = [
      { weight: "A", value: 1 },
      { weight: "A", value: 5 },
      { weight: "B", value: 1 },
      { weight: "B", value: 9 },
    ];
    const gd = group(collide, { by: "weight", value: "value" });
    expect(() => groupedHistogram(gd)).toThrow(RangeError);
  });
  it("summarize surfaces subtotals + grand total under rollup", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    const s = summarize(gd);
    expect(s.some((r) => r.depth === 0)).toBe(true); // grand total present
    expect(s.filter((r) => r.depth === 1).length).toBe(2); // both leaf cats
    const noOverall = summarize(gd, { includeOverall: false });
    expect(noOverall.some((r) => r.depth === 0)).toBe(false);
  });
  it('rollup: "cube" margins surface through summarize; plot helpers stay leaves-only', () => {
    const facet = [
      { col: "A", row: "p", value: 1, weight: 10 },
      { col: "A", row: "q", value: 5, weight: 10 },
      { col: "B", row: "p", value: 2, weight: 10 },
      { col: "B", row: "q", value: 9, weight: 10 },
    ];
    const gd = group(facet, {
      by: ["col", "row"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });

    // summarize defaults to including subtotals + overall, so the orthogonal (col-rolled) margins appear.
    const s = summarize(gd);
    const rowMargins = s.filter((r) => r.col === "(All)" && r.row !== "(All)" && r.depth === 1);
    expect(rowMargins.length).toBe(2); // {(All),p} and {(All),q} — the column prefix ROLLUP omits

    // Plot helpers still default to leaves only (no LevelSelect) — no margins double-counted in overlays.
    const bins = groupedHistogram(gd);
    expect(bins.every((b) => b.depth === 2)).toBe(true);
  });
});

describe("groupedKde kernels & bandwidth", () => {
  // Overall distribution here is heavy-tailed: IQR/1.349 << stdev, so Scott (stdev-only) and
  // Silverman (robust min) give clearly different bandwidths — making the Scott path observable.
  const rows = [
    { g: "a", v: 0, w: 5 },
    { g: "a", v: 1, w: 5 },
    { g: "b", v: 1, w: 5 },
    { g: "b", v: 20, w: 1 },
  ];
  const gd = group(rows, { by: "g", value: "v", weight: "w" });

  it("forwards the kernel option to every series", () => {
    const gauss = groupedKde(gd, { bandwidth: 1, kernel: "gaussian" });
    const epan = groupedKde(gd, { bandwidth: 1, kernel: "epanechnikov" });
    expect(gauss.length).toBe(epan.length);
    const differs = gauss.some((p, i) => Math.abs(p.density - epan[i]!.density) > 1e-9);
    expect(differs).toBe(true);
  });

  it("derives the shared bandwidth via Scott when bandwidth: 'scott'", () => {
    const overallScott = scottBandwidth(gd.overall.n, stdev(gd.overall));
    const byName = groupedKde(gd, { bandwidth: "scott", kernel: "gaussian" });
    const byNumber = groupedKde(gd, { bandwidth: overallScott, kernel: "gaussian" });
    expect(byName.length).toBe(byNumber.length);
    for (let i = 0; i < byName.length; i++) {
      expect(byName[i]!.density).toBeCloseTo(byNumber[i]!.density, 10);
      expect(byName[i]!.x).toBeCloseTo(byNumber[i]!.x, 10);
    }
  });
});
