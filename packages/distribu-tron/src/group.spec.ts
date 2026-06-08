import { describe, it, expect } from "vitest";
import { group } from "./group";
import { mean } from "./descriptives";

const rows = [
  { category: "Bikes", series: "2024", value: 20, weight: 1200 },
  { category: "Bikes", series: "2025", value: 20, weight: 1110 },
  { category: "Bikes", series: "2025", value: 24, weight: 145 },
  { category: "Accessories", series: "2024", value: 10, weight: 1203 },
  { category: "Accessories", series: "2025", value: 10, weight: 540 },
];

describe("group", () => {
  it("leaves + overall (no rollup)", () => {
    const gd = group(rows, { by: ["category", "series"], value: "value", weight: "weight" });
    expect(gd.dimensions).toEqual(["category", "series"]);
    expect(gd.leaves.length).toBe(4);
    expect(gd.groups.length).toBe(4); // leaves only without rollup
    expect(gd.overall.n).toBe(4198);
    const bikes24 = gd.leaves.find((g) => g.key.category === "Bikes" && g.key.series === "2024")!;
    expect(bikes24.distribution.n).toBe(1200);
    expect(bikes24.depth).toBe(2);
  });
  it("rollup adds subtotals + grand total with level/depth", () => {
    const gd = group(rows, { by: ["category", "series"], value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    const catSub = gd.groups.find((g) => g.depth === 1 && g.key.category === "Bikes")!;
    expect(catSub.key.series).toBe("(All)");
    expect(catSub.level).toEqual(["category"]);
    expect(catSub.distribution.n).toBe(1200 + 1110 + 145); // Bikes across series
    const grand = gd.groups.find((g) => g.depth === 0)!;
    expect(grand.key).toEqual({ category: "(All)", series: "(All)" });
    expect(mean(grand.distribution)).toBeCloseTo(mean(gd.overall), 12);
  });
  it("single dimension", () => {
    const gd = group(rows, { by: "category", value: "value", weight: "weight" });
    expect(gd.dimensions).toEqual(["category"]);
    expect(gd.leaves.length).toBe(2);
  });
  it("function accessors for value and weight", () => {
    const gd = group(rows, {
      by: "category",
      value: (r) => r.value as number,
      weight: (r) => r.weight as number,
    });
    expect(gd.leaves.length).toBe(2);
    expect(gd.overall.n).toBe(4198);
  });
  it("single-dimension rollup adds only the grand total (no subtotals)", () => {
    const gd = group(rows, { by: "category", value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    // leaves (2) + grand total (1); no depth-1 subtotals exist for a single dimension
    expect(gd.groups.length).toBe(3);
    expect(gd.groups.filter((g) => g.depth === 0).length).toBe(1);
    expect(gd.groups.filter((g) => g.depth === 1).length).toBe(2);
  });
});
