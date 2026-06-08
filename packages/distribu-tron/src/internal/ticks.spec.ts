import { describe, it, expect } from "vitest";
import { ticks, tickIncrement, nice } from "./ticks";

describe("ticks", () => {
  it("nice integer ticks", () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(ticks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it("edge cases", () => {
    expect(ticks(5, 5, 10)).toEqual([5]);
    expect(ticks(0, 10, 0)).toEqual([]);
  });
});
describe("nice", () => {
  it("rounds outward", () => {
    expect(nice(2, 98, 10)).toEqual([0, 100]);
  });
});
describe("tickIncrement", () => {
  it("step", () => {
    expect(tickIncrement(0, 10, 5)).toBe(2);
  });
});
