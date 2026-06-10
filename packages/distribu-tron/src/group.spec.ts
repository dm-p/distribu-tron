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
    const gd = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: true,
      totalLabel: "(All)",
    });
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
  it('rollup: "cube" emits orthogonal margins (the (All) column prefix ROLLUP omits)', () => {
    const gd = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });
    // Distinct levels in emit order: leaves, then depth-1 by ascending by-position, then grand.
    const levels = [...new Set(gd.groups.map((g) => g.level.join("|")))];
    expect(levels).toEqual(["category|series", "category", "series", ""]);

    // The NEW orthogonal margin: category rolled up, series active.
    const seriesMargin = gd.groups.filter((g) => g.level.length === 1 && g.level[0] === "series");
    expect(seriesMargin.length).toBe(2);
    const m2024 = seriesMargin.find((g) => g.key.series === "2024")!;
    expect(m2024.key.category).toBe("(All)");

    // Merge-equals: rolling category fully up == grouping by "series" alone (an independent path).
    const bySeries = group(rows, { by: "series", value: "value", weight: "weight" });
    const leaf2024 = bySeries.leaves.find((g) => g.key.series === "2024")!;
    expect(m2024.distribution.n).toBe(leaf2024.distribution.n); // 1200 + 1203 = 2403
    // Identical substrate ⇒ identical quantiles/moments — the margin IS the merge of its leaves.
    expect(Array.from(m2024.distribution.values)).toEqual(Array.from(leaf2024.distribution.values));
    expect(Array.from(m2024.distribution.weights)).toEqual(Array.from(leaf2024.distribution.weights));
  });

  it('rollup: "prefix" equals rollup: true and omits the orthogonal margin (back-compat)', () => {
    const viaBool = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: true,
      totalLabel: "(All)",
    });
    const viaStr = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: "prefix",
      totalLabel: "(All)",
    });
    const norm = (gd: ReturnType<typeof group>) =>
      gd.groups.map((g) => ({ key: g.key, level: g.level, depth: g.depth, n: g.distribution.n }));
    expect(norm(viaStr)).toEqual(norm(viaBool));
    // Prefix has NO series-only margin — exactly the gap cube fills.
    const levels = [...new Set(viaBool.groups.map((g) => g.level.join("|")))];
    expect(levels).toEqual(["category|series", "category", ""]);
  });

  it("sorted:true does not corrupt overall or rollup subtotals (cross-group concatenation)", () => {
    // each leaf's rows arrive value-ascending (so sorted:true is valid per-leaf), but across groups the
    // values interleave — overall and subtotals concatenate them and must still sort/aggregate.
    const interleaved = [
      { cat: "A", sub: "x", value: 10, weight: 1 },
      { cat: "A", sub: "x", value: 50, weight: 1 }, // leaf (A,x): [10, 50]
      { cat: "A", sub: "y", value: 30, weight: 1 }, // leaf (A,y): [30]
      { cat: "B", sub: "x", value: 20, weight: 1 }, // leaf (B,x): [20]
    ];
    const gd = group(interleaved, {
      by: ["cat", "sub"],
      value: "value",
      weight: "weight",
      rollup: true,
      totalLabel: "(All)",
      sorted: true,
    });
    // subtotal A merges (A,x)=[10,50] + (A,y)=[30] → concatenation [10,50,30]; must come out sorted
    const subA = gd.groups.find((g) => g.depth === 1 && g.key.cat === "A")!;
    expect(Array.from(subA.distribution.values)).toEqual([10, 30, 50]);
    expect(Array.from(subA.distribution.cumulativeWeights)).toEqual([1, 2, 3]);
    // overall across all rows must also be sorted, not left in row order
    expect(Array.from(gd.overall.values)).toEqual([10, 20, 30, 50]);
    expect(gd.overall.n).toBe(4);
  });
});
