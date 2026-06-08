import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { summary } from "./summary";

describe("summary", () => {
  it("bundles scalar descriptives + quartiles", () => {
    const s = summary(distribution([1, 2, 3, 4, 5]));
    expect(s.n).toBe(5);
    expect(s.size).toBe(5);
    expect(s.median).toBe(3);
    expect(s.q1).toBe(2);
    expect(s.q3).toBe(4);
    expect(s.iqr).toBe(2);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.range).toBe(4);
    expect(s.mean).toBeCloseTo(3, 12);
  });
});
