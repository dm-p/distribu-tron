import { describe, expect, it } from "vitest";
import { KERNEL_NAMES, resolveKernel } from "./kernels";

// Midpoint numeric integration of f over [lo, hi].
function integrate(f: (u: number) => number, lo: number, hi: number, n = 400000): number {
  const dx = (hi - lo) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += f(lo + (i + 0.5) * dx) * dx;
  return s;
}

describe("resolveKernel", () => {
  it("defaults to gaussian", () => {
    expect(resolveKernel().name).toBe("gaussian");
    expect(resolveKernel(undefined).name).toBe("gaussian");
  });
  it("throws on an unknown kernel", () => {
    // @ts-expect-error testing the runtime guard
    expect(() => resolveKernel("boxcar")).toThrow(RangeError);
  });
});

describe("kernel correctness", () => {
  // Each unit kernel integrates to 1, and its variance equals (1 / sdScale)^2 — the contract that
  // makes `bandwidth = sdScale * h` produce a kernel whose standard deviation is exactly h.
  for (const name of KERNEL_NAMES) {
    it(`${name}: integrates to 1 and has variance 1/sdScale^2`, () => {
      const k = resolveKernel(name);
      const lo = name === "gaussian" ? -10 : -1;
      const hi = name === "gaussian" ? 10 : 1;
      expect(integrate((u) => k.k(u), lo, hi)).toBeCloseTo(1, 3);
      expect(integrate((u) => u * u * k.k(u), lo, hi)).toBeCloseTo(1 / (k.sdScale * k.sdScale), 3);
    });
  }
});
