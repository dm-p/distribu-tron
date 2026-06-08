import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { boxplot } from "./boxplot";

describe("boxplot", () => {
  it("fences + outliers (1.5·IQR)", () => {
    const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);
    const b = boxplot(d);
    expect(b.outliers).toContain(100);
    expect(b.upperFence).toBeLessThan(100);
    expect(b.min).toBe(1); expect(b.max).toBe(100);
    expect(b.median).toBe(6);
  });
  it("no outliers when tight", () => {
    expect(boxplot(distribution([1, 2, 3, 4, 5])).outliers).toEqual([]);
  });
});
