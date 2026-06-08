import { describe, it, expect } from "vitest";
import { group } from "./group";
import { summarize, groupedHistogram, groupedKde } from "./group";

const rows = [
  { cat: "A", value: 1, weight: 10 }, { cat: "A", value: 5, weight: 10 },
  { cat: "B", value: 1, weight: 10 }, { cat: "B", value: 9, weight: 10 },
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
    expect(aEdges).toEqual(bEdges);          // shared domain
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
  it("summarize surfaces subtotals + grand total under rollup", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    const s = summarize(gd);
    expect(s.some((r) => r.depth === 0)).toBe(true);     // grand total present
    expect(s.filter((r) => r.depth === 1).length).toBe(2); // both leaf cats
    const noOverall = summarize(gd, { includeOverall: false });
    expect(noOverall.some((r) => r.depth === 0)).toBe(false);
  });
});
