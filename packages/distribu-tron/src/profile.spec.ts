import { describe, it, expect } from "vitest";
import { time } from "./profile";

describe("time", () => {
  it("returns the value and a non-negative ms", () => {
    const r = time(() => 21 * 2);
    expect(r.value).toBe(42);
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });
});
