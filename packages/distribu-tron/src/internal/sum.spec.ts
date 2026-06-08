import { describe, it, expect } from "vitest";
import { neumaierSum, neumaierSumMap } from "./sum";

describe("neumaierSum", () => {
  it("sums exactly where naive drifts", () => {
    expect(neumaierSum([1e16, 1, -1e16])).toBe(1); // naive gives 0
    expect(neumaierSum([])).toBe(0);
  });
});
describe("neumaierSumMap", () => {
  it("sums a mapped sequence", () => {
    expect(neumaierSumMap(3, (i) => (i + 1) * 2)).toBe(12); // 2+4+6
  });
  it("compensates through the callback where naive drifts", () => {
    const terms = [1e16, 1, -1e16];
    expect(neumaierSumMap(terms.length, (i) => terms[i]!)).toBe(1); // naive gives 0
  });
  it("count = 0 sums to 0", () => {
    expect(neumaierSumMap(0, () => 1)).toBe(0);
  });
});
