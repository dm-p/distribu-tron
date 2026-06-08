import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { boxplot } from "./boxplot";

describe("boxplot", () => {
  it("fences + outliers (1.5·IQR)", () => {
    const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);
    const b = boxplot(d);
    expect(b.outliers).toContain(100);
    expect(b.upperFence).toBeLessThan(100);
    expect(b.min).toBe(1);
    expect(b.max).toBe(100);
    expect(b.median).toBe(6);
    // whisker end is the highest in-fence value (10), distinct from max (100, an outlier)
    expect(b.upperAdjacent).toBe(10);
    expect(b.lowerAdjacent).toBe(1);
  });
  it("no outliers when tight", () => {
    const b = boxplot(distribution([1, 2, 3, 4, 5]));
    expect(b.outliers).toEqual([]);
    expect(b.lowerAdjacent).toBe(1);
    expect(b.upperAdjacent).toBe(5); // == max when nothing is an outlier
  });
  it("zero-weight values are not reported as outliers (no mass)", () => {
    // value 100 carries zero weight, so it is not an observation and must not be an outlier
    const d = distribution([
      { value: 1, weight: 1 },
      { value: 2, weight: 1 },
      { value: 100, weight: 0 },
    ]);
    expect(boxplot(d).outliers).toEqual([]);
  });
});
