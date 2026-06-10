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

// Distinct 3-D cross-product: every pair-projection is also distinct, so cube's depth-2 faces stay fully
// populated — which is what makes the "margins omits depth-2" assertion a real contrast, not vacuous.
const rows3 = [
  { a: "x", b: "p", c: "m", value: 1, weight: 1 },
  { a: "x", b: "q", c: "n", value: 2, weight: 1 },
  { a: "y", b: "p", c: "n", value: 3, weight: 1 },
  { a: "y", b: "q", c: "m", value: 4, weight: 1 },
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

  it('rollup: "cube" enumerates all 2^N grouping-sets (N=3), deepest-first then lexicographic', () => {
    const gd = group(rows3, {
      by: ["a", "b", "c"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });
    const levels = [...new Set(gd.groups.map((g) => g.level.join("|")))];
    // This exact ordering IS the same-depth ordering guarantee (descending size, then ascending by-position).
    expect(levels).toEqual(["a|b|c", "a|b", "a|c", "b|c", "a", "b", "c", ""]);
  });

  it('rollup: "margins" emits only single-dimension margins — no intermediate faces (N=3)', () => {
    const gd = group(rows3, {
      by: ["a", "b", "c"],
      value: "value",
      weight: "weight",
      rollup: "margins",
      totalLabel: "(All)",
    });
    const levels = [...new Set(gd.groups.map((g) => g.level.join("|")))];
    expect(levels).toEqual(["a|b|c", "a", "b", "c", ""]);
    expect(gd.groups.some((g) => g.depth === 2)).toBe(false); // the depth-2 faces cube has, margins omits
    // Lock the COUNT of margin groups, not just their level labels: 3 dims × 2 cells each = 6 depth-1 groups.
    expect(gd.groups.filter((g) => g.depth === 1).length).toBe(6);
    // Spot-check the merge aggregates the right leaves at N=3: the a="x" margin sums its 2 constituent rows.
    const marginAx = gd.groups.find((g) => g.depth === 1 && g.level[0] === "a" && g.key.a === "x")!;
    expect(marginAx.distribution.n).toBe(2);
  });

  it('rollup: "margins" === "cube" for N ≤ 2', () => {
    const norm = (gd: ReturnType<typeof group>) =>
      gd.groups.map((g) => ({ key: g.key, level: g.level, depth: g.depth, n: g.distribution.n }));
    const cube = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });
    const margins = group(rows, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: "margins",
      totalLabel: "(All)",
    });
    expect(norm(margins)).toEqual(norm(cube));
  });

  it("N=1: prefix / margins / cube all collapse to leaves + grand (one axis to roll up)", () => {
    for (const rollup of [true, "prefix", "margins", "cube"] as const) {
      const gd = group(rows, { by: "category", value: "value", weight: "weight", rollup, totalLabel: "(All)" });
      expect(gd.groups.length).toBe(3); // 2 leaves + grand total
      expect(gd.groups.filter((g) => g.depth === 1).length).toBe(2);
      expect(gd.groups.filter((g) => g.depth === 0).length).toBe(1);
    }
  });

  it('rollup: "cube" emits no empty margins for a sparse cross-product (absent cells stay absent)', () => {
    const sparse = [
      { a: "x", b: "p", value: 1, weight: 1 },
      { a: "x", b: "q", value: 2, weight: 1 },
      { a: "y", b: "p", value: 3, weight: 1 },
      // (y, q) absent: a leaf/margin is only emitted for cells that actually occur.
    ];
    const gd = group(sparse, { by: ["a", "b"], value: "value", weight: "weight", rollup: "cube", totalLabel: "(All)" });
    // Only present cells produce groups: 3 leaves (not 4) + 2 a-margins + 2 b-margins + grand = 8.
    expect(gd.leaves.length).toBe(3);
    expect(gd.groups.length).toBe(8);
    // No (y, q) leaf is synthesized, and every emitted group has positive mass (no empty Distributions).
    expect(gd.groups.some((g) => g.depth === 2 && g.key.a === "y" && g.key.b === "q")).toBe(false);
    expect(gd.groups.every((g) => g.distribution.n > 0)).toBe(true);
  });

  it('rollup: "cube" keeps a real value equal to totalLabel disambiguable by depth, not key', () => {
    // A real `series` value literally equal to the totalLabel collides with the rolled-up label. cube
    // widens this surface (it also rolls the leading dim), so the same key string can appear at two depths.
    const collide = [
      { category: "Bikes", series: "(All)", value: 5, weight: 5 }, // real value collides with totalLabel
      { category: "Bikes", series: "2025", value: 10, weight: 7 },
    ];
    const gd = group(collide, {
      by: ["category", "series"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });
    // {Bikes,(All)} exists at BOTH depth 2 (the real leaf) and depth 1 (the category margin):
    const bikesAll = gd.groups.filter((g) => g.key.category === "Bikes" && g.key.series === "(All)");
    expect(bikesAll.map((g) => g.depth).sort()).toEqual([1, 2]);
    expect(bikesAll.find((g) => g.depth === 2)!.distribution.n).toBe(5); // the real leaf, its own rows only
    expect(bikesAll.find((g) => g.depth === 1)!.distribution.n).toBe(12); // category margin: both series merged
    // the grand total is unaffected by the colliding label.
    expect(gd.groups.find((g) => g.depth === 0)!.distribution.n).toBe(gd.overall.n); // 12
  });

  it('rollup: "cube" merges intermediate (depth N-1) faces across the rolled dimension at N=3', () => {
    // Two rows share (a=x, c=m) but differ in b, so the [a,c] face cell must merge them across rolled b.
    const facets3 = [
      { a: "x", b: "p", c: "m", value: 10, weight: 2 },
      { a: "x", b: "q", c: "m", value: 20, weight: 3 },
      { a: "y", b: "p", c: "n", value: 30, weight: 1 },
    ];
    const gd = group(facets3, {
      by: ["a", "b", "c"],
      value: "value",
      weight: "weight",
      rollup: "cube",
      totalLabel: "(All)",
    });
    const faceXM = gd.groups.find(
      (g) => g.depth === 2 && g.level.join("|") === "a|c" && g.key.a === "x" && g.key.c === "m",
    )!;
    expect(faceXM.key.b).toBe("(All)"); // b rolled up on this face
    expect(faceXM.distribution.n).toBe(5); // 2 + 3
    expect(Array.from(faceXM.distribution.values)).toEqual([10, 20]);
    expect(Array.from(faceXM.distribution.weights)).toEqual([2, 3]);
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
