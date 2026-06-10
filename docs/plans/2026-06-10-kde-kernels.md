# KDE Kernels & Bandwidth Selectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four selectable KDE kernels (gaussian default, epanechnikov, triangular, cosine) and a Scott bandwidth selector, with `bandwidth` redefined as the kernel standard deviation so curves are smooth and comparable across kernels.

**Architecture:** A new `internal/kernels.ts` registry defines each kernel by its unit function, SD→native-scale factor, and window radius. `kde()` resolves the kernel and an SD-scale bandwidth once, then runs one generic windowed density scan (Gaussian truncated at ±4σ). A single shared `resolveBandwidth` (silverman/scott/numeric) is used by both `kde()` and `groupedKde()`.

**Tech Stack:** TypeScript (ESM), Vitest, Biome, tsup. Zero runtime deps. Run from `packages/distribu-tron/`.

**Spec:** [docs/designs/2026-06-10-kde-kernels-design.md](../designs/2026-06-10-kde-kernels-design.md)

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/types.ts` | Public types | Add `KdeKernel`; widen `KdeOptions.kernel` + `bandwidth` |
| `src/internal/kernels.ts` | Kernel registry (unit fn, sdScale, radius) + `resolveKernel` | **Create** |
| `src/internal/kernels.spec.ts` | Kernel correctness (integral≈1, variance) | **Create** |
| `src/internal/silverman.ts` | Bandwidth rules: silverman (existing) + scott + shared `resolveBandwidth` | Modify |
| `src/kde.ts` | Kernel-driven density; gaussian default; SD bandwidth; export `scottBandwidth` | Modify |
| `src/kde.spec.ts` | Update `naive` helper + add kernel/scott/smoothness tests | Modify |
| `src/group.ts` | Use shared `resolveBandwidth` (scott-aware); kernel auto-forwarded | Modify |
| `src/group-consumers.spec.ts` | `groupedKde` forwards kernel + scott shared bandwidth | Modify |
| `src/index.ts` | Export `scottBandwidth` | Modify |
| `src/index.spec.ts` | Assert `scottBandwidth` exported | Modify |
| `README.md` (root) | KDE section: kernels, gaussian default, bandwidth = SD | Modify |
| `bench/kde.bench.ts` | Per-kernel comparison bench (no asserts) | Create/modify |

> **Commands** (run from `packages/distribu-tron/`): test `pnpm vitest run <file>`; all tests `pnpm vitest run`; typecheck `pnpm tsc --noEmit`; lint `pnpm lint`; build `pnpm build`. The shell resets to repo root between turns — use `cd packages/distribu-tron && pnpm …`.

> **Commits:** GPG signing is unavailable in the agent shell in this environment; if a `git commit` step fails to sign, stage the listed files and surface the commit command for the human to run, then continue. Do not bypass signing.

---

## Task 1: Public types — `KdeKernel` and widened `KdeOptions`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the kernel type and widen the options**

In `src/types.ts`, replace the existing `KdeOptions` interface:

```ts
export interface KdeOptions {
  bandwidth?: number | "silverman";
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  kernel?: "epanechnikov";
}
```

with:

```ts
export type KdeKernel = "gaussian" | "epanechnikov" | "triangular" | "cosine";

export interface KdeOptions {
  /** Numeric bandwidth = the kernel standard deviation. Defaults to "silverman". */
  bandwidth?: number | "silverman" | "scott";
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  /** Smoothing kernel. Defaults to "gaussian". */
  kernel?: KdeKernel;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/distribu-tron && pnpm tsc --noEmit`
Expected: PASS (types-only change; nothing consumes the new members yet).

- [ ] **Step 3: Commit**

```bash
git add packages/distribu-tron/src/types.ts
git commit -m "feat(kde): widen KdeOptions for kernels and scott bandwidth"
```

---

## Task 2: Kernel registry (`internal/kernels.ts`)

**Files:**
- Create: `src/internal/kernels.ts`
- Test: `src/internal/kernels.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/internal/kernels.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/distribu-tron && pnpm vitest run src/internal/kernels.spec.ts`
Expected: FAIL — `Cannot find module "./kernels"`.

- [ ] **Step 3: Implement `internal/kernels.ts`**

Create `src/internal/kernels.ts`:

```ts
import type { KdeKernel } from "../types";

/**
 * A KDE kernel strategy. `k(u)` is the UNIT kernel (integrates to 1; for compact kernels `k(u)=0`
 * outside `|u|<=1`). `sdScale` maps a standard-deviation bandwidth to the kernel's native scale:
 * `a = bandwidth * sdScale`, chosen so the kernel's standard deviation equals the bandwidth.
 * `radius` is the scan half-width in bandwidth units: the window is `[x - radius*bw, x + radius*bw]`.
 */
export interface Kernel {
  readonly name: KdeKernel;
  readonly k: (u: number) => number;
  readonly sdScale: number;
  readonly radius: number;
}

const SQRT5 = Math.sqrt(5);
const SQRT6 = Math.sqrt(6);
const COSINE_SD_SCALE = 1 / Math.sqrt(1 - 8 / (Math.PI * Math.PI));
const GAUSSIAN_NORM = 1 / Math.sqrt(2 * Math.PI);
// Truncate the (infinite-support) Gaussian at 4 standard deviations: drops ~6.3e-5 of the mass.
const GAUSSIAN_TRUNCATION = 4;

const gaussian: Kernel = {
  name: "gaussian",
  k: (u) => GAUSSIAN_NORM * Math.exp(-0.5 * u * u),
  sdScale: 1,
  radius: GAUSSIAN_TRUNCATION,
};
const epanechnikov: Kernel = {
  name: "epanechnikov",
  k: (u) => (Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0),
  sdScale: SQRT5,
  radius: SQRT5,
};
const triangular: Kernel = {
  name: "triangular",
  k: (u) => (Math.abs(u) <= 1 ? 1 - Math.abs(u) : 0),
  sdScale: SQRT6,
  radius: SQRT6,
};
const cosine: Kernel = {
  name: "cosine",
  k: (u) => (Math.abs(u) <= 1 ? (Math.PI / 4) * Math.cos((Math.PI / 2) * u) : 0),
  sdScale: COSINE_SD_SCALE,
  radius: COSINE_SD_SCALE,
};

const KERNELS: Record<KdeKernel, Kernel> = { gaussian, epanechnikov, triangular, cosine };

export const KERNEL_NAMES = Object.keys(KERNELS) as KdeKernel[];

export function resolveKernel(name: KdeKernel = "gaussian"): Kernel {
  const kernel = KERNELS[name];
  if (!kernel) throw new RangeError(`Unknown KDE kernel: ${name}`);
  return kernel;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/distribu-tron && pnpm vitest run src/internal/kernels.spec.ts`
Expected: PASS — `resolveKernel` (2) + correctness (4) = 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/distribu-tron/src/internal/kernels.ts packages/distribu-tron/src/internal/kernels.spec.ts
git commit -m "feat(kde): add kernel registry (gaussian, epanechnikov, triangular, cosine)"
```

---

## Task 3: Bandwidth rules — Scott + shared `resolveBandwidth`

**Files:**
- Modify: `src/internal/silverman.ts`
- Test: `src/internal/silverman.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/internal/silverman.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distribution } from "../distribution";
import { resolveBandwidth, scottBandwidth, silvermanBandwidth } from "./silverman";

describe("scottBandwidth", () => {
  it("is 1.06 * sd * n^(-1/5)", () => {
    expect(scottBandwidth(100, 2)).toBeCloseTo(1.06 * 2 * Math.pow(100, -0.2), 12);
  });
  it("equals silverman when stdev <= IQR/1.349 (silverman's robust term is inactive)", () => {
    // stdev 2 < iqr/1.349 (7.41) → silverman uses stdev too → identical
    expect(scottBandwidth(100, 2)).toBeCloseTo(silvermanBandwidth(100, 10, 2), 12);
  });
  it("differs from silverman when IQR/1.349 < stdev (robust term active)", () => {
    // iqr/1.349 = 1 < stdev 10 → silverman uses 1, scott uses 10
    expect(silvermanBandwidth(100, 1.349, 10)).not.toBeCloseTo(scottBandwidth(100, 10), 6);
  });
});

describe("resolveBandwidth", () => {
  const d = distribution([
    { value: 1, weight: 2 },
    { value: 2, weight: 5 },
    { value: 3, weight: 3 },
  ]);
  it("passes a numeric bandwidth through unchanged", () => {
    expect(resolveBandwidth(d, 1.5)).toBe(1.5);
  });
  it("maps 'silverman' and 'scott' to their respective rules", () => {
    // scott uses stdev only; silverman uses min(stdev, iqr/1.349) — both > 0 here
    expect(resolveBandwidth(d, "scott")).toBeGreaterThan(0);
    expect(resolveBandwidth(d, "silverman")).toBeGreaterThan(0);
    expect(resolveBandwidth(d, undefined)).toBe(resolveBandwidth(d, "silverman"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/distribu-tron && pnpm vitest run src/internal/silverman.spec.ts`
Expected: FAIL — `resolveBandwidth`/`scottBandwidth` are not exported.

- [ ] **Step 3: Implement the additions**

In `src/internal/silverman.ts`, update the import line and append the new functions. The current top import is:

```ts
import type { Distribution } from "../types";
```

Replace it with:

```ts
import type { Distribution, KdeOptions } from "../types";
```

Then append at the end of the file (keep `silvermanBandwidth` and `silvermanFor` as they are):

```ts
/**
 * Scott's normal-reference bandwidth: `1.06 · sd · n^(-1/5)`. Like Silverman but without the robust
 * `min(·, IQR/1.349)` term, so it uses the full standard deviation. Returns a standard-deviation-scale
 * bandwidth, matching the `bandwidth = kernel SD` convention.
 */
export function scottBandwidth(n: number, sd: number): number {
  return 1.06 * sd * Math.pow(n, -0.2);
}

/** Derive Scott's bandwidth from a prepared distribution (weighted population stdev). 0 if degenerate. */
export function scottFor(d: Distribution): number {
  if (d.size === 0 || d.n <= 0) return 0;
  return scottBandwidth(d.n, stdev(d));
}

/**
 * Resolve a `KdeOptions["bandwidth"]` to a numeric standard-deviation bandwidth. Numeric values pass
 * through; `"scott"` and `"silverman"` (the default) derive from the distribution. Shared by `kde()`
 * and `groupedKde()` so the two never drift.
 */
export function resolveBandwidth(d: Distribution, bw: KdeOptions["bandwidth"]): number {
  if (typeof bw === "number") return bw;
  if (bw === "scott") return scottFor(d);
  return silvermanFor(d);
}
```

(`stdev` is already imported at the top of `silverman.ts` for `silvermanFor`; reuse it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/distribu-tron && pnpm vitest run src/internal/silverman.spec.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/distribu-tron/src/internal/silverman.ts packages/distribu-tron/src/internal/silverman.spec.ts
git commit -m "feat(kde): add scott bandwidth and a shared resolveBandwidth"
```

---

## Task 4: Kernel-driven `kde()`

**Files:**
- Modify: `src/kde.ts`
- Modify: `src/kde.spec.ts`

- [ ] **Step 1: Update the existing test's `naive` helper and the windowed-equality test**

In `src/kde.spec.ts`, replace the `naive` function (currently hard-coded Epanechnikov-as-half-width) with an SD-aware Epanechnikov reference, and update the windowed-equality test to select that kernel. Replace lines 15–33 (the `naive` function and the `"windowed == naive"` test) with:

```ts
// Epanechnikov reference under SD-scale bandwidth: native half-width a = h * sqrt(5).
function naiveEpanechnikov(x: number, h: number): number {
  const a = h * Math.sqrt(5);
  let acc = 0;
  for (let i = 0; i < d.size; i++) {
    const u = (x - d.values[i]!) / a;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / a : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return acc;
}

describe("kde", () => {
  it("empty → []", () => {
    expect(kde(distribution([]), {})).toEqual([]);
  });
  it("windowed epanechnikov == naive at every returned point", () => {
    const pts = kde(d, { bandwidth: 1.5, kernel: "epanechnikov", clamp: false, resolution: 50 });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeCloseTo(naiveEpanechnikov(p.x, 1.5), 6);
  });
```

> Note: this replaces the original `describe("kde", () => {` opener and its first two `it` blocks. Leave the remaining `it` blocks (never negative, samplePoints, the silverman* unit tests, peaked-but-spread, default path, clamp, single-value) intact below — they still pass under the Gaussian default (none assert a specific Epanechnikov density). Do not remove the closing `});` of the describe block.

- [ ] **Step 2: Add new tests for the kernel feature**

Insert these tests inside the `describe("kde", …)` block in `src/kde.spec.ts`, just before its closing `});`:

```ts
  it("defaults to the gaussian kernel", () => {
    // Gaussian and epanechnikov differ at a fixed bandwidth; the default must equal gaussian.
    const def = kde(d, { bandwidth: 1.5, samplePoints: [3.5] })[0]!.density;
    const gauss = kde(d, { bandwidth: 1.5, kernel: "gaussian", samplePoints: [3.5] })[0]!.density;
    const epan = kde(d, { bandwidth: 1.5, kernel: "epanechnikov", samplePoints: [3.5] })[0]!.density;
    expect(def).toBeCloseTo(gauss, 12);
    expect(def).not.toBeCloseTo(epan, 6);
  });

  it("gaussian default is smooth on a coarse-bandwidth dataset (few extrema)", () => {
    const exam = distribution([
      { value: 0, weight: 8 }, { value: 4, weight: 19 }, { value: 8, weight: 34 },
      { value: 12, weight: 49 }, { value: 16, weight: 58 }, { value: 20, weight: 52 },
      { value: 24, weight: 40 }, { value: 28, weight: 27 }, { value: 32, weight: 16 },
      { value: 36, weight: 8 }, { value: 40, weight: 4 },
    ]);
    const pts = kde(exam, { bandwidth: 6 });
    let extrema = 0;
    let prev = 0;
    for (let i = 1; i < pts.length; i++) {
      const s = Math.sign(pts[i]!.density - pts[i - 1]!.density);
      if (s !== 0 && prev !== 0 && s !== prev) extrema++;
      if (s !== 0) prev = s;
    }
    expect(extrema).toBeLessThanOrEqual(3); // a smooth unimodal-ish curve, not the Epanechnikov scallop
  });

  it("the same bandwidth gives comparable spread across kernels (SD-normalized)", () => {
    // Weighted standard deviation of the resulting density should be ~equal across kernels.
    const spread = (kernel: "gaussian" | "epanechnikov" | "triangular" | "cosine") => {
      const pts = kde(d, { bandwidth: 1.2, kernel, resolution: 200 });
      const tot = pts.reduce((s, p) => s + p.density, 0);
      const mean = pts.reduce((s, p) => s + p.x * p.density, 0) / tot;
      const varr = pts.reduce((s, p) => s + (p.x - mean) ** 2 * p.density, 0) / tot;
      return Math.sqrt(varr);
    };
    const g = spread("gaussian");
    for (const k of ["epanechnikov", "triangular", "cosine"] as const) {
      expect(spread(k)).toBeCloseTo(g, 1); // within ~0.05 absolute
    }
  });

  it("gaussian truncation at 4σ conserves ~all of the density mass", () => {
    const pts = kde(d, { bandwidth: 1.0, kernel: "gaussian", resolution: 400 });
    // trapezoidal integral over the returned grid ≈ 1 (truncation loses < 0.1%)
    let area = 0;
    for (let i = 1; i < pts.length; i++) {
      area += ((pts[i]!.density + pts[i - 1]!.density) / 2) * (pts[i]!.x - pts[i - 1]!.x);
    }
    expect(area).toBeCloseTo(1, 2);
  });

  it("bandwidth: 'scott' produces a usable curve", () => {
    const pts = kde(d, { bandwidth: "scott" });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeGreaterThanOrEqual(0);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `cd packages/distribu-tron && pnpm vitest run src/kde.spec.ts`
Expected: FAIL — the default-kernel and smoothness tests fail because `kde()` still uses Epanechnikov and treats `bandwidth` as a half-width.

- [ ] **Step 4: Rewrite `kde.ts` to be kernel-driven**

Replace the body of `src/kde.ts` from the imports down through the `density` function. Specifically:

Replace the top imports:

```ts
import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";
import { silvermanFor } from "./internal/silverman";

export { silvermanBandwidth } from "./internal/silverman";
```

with:

```ts
import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";
import { type Kernel, resolveKernel } from "./internal/kernels";
import { resolveBandwidth } from "./internal/silverman";

export { silvermanBandwidth, scottBandwidth } from "./internal/silverman";
```

Replace the `kde` function body so it resolves the kernel and uses the shared bandwidth resolver:

```ts
export function kde(d: Distribution, options: KdeOptions = {}): KdePoint[] {
  if (d.size === 0 || d.n <= 0) return [];
  const bandwidth = resolveBandwidth(d, options.bandwidth);
  if (!(bandwidth > 0)) return [];
  const kernel = resolveKernel(options.kernel);
  const clamp = options.clamp ?? false;
  const sample = options.samplePoints
    ? Array.from(options.samplePoints)
    : buildSamplePoints(d.min, d.max, options.resolution ?? DEFAULT_RESOLUTION, clamp);
  const pts: KdePoint[] = sample.map((x) => ({ x, density: density(d, x, bandwidth, kernel) }));
  if (options.samplePoints) return pts; // caller controls the grid exactly
  return clamp ? pts.filter((p) => p.x >= d.min && p.x <= d.max) : trimZeroTails(pts);
}
```

Delete the old private `resolveBandwidth` function (the one that returned `typeof bw === "number" ? bw : silvermanFor(d)`) — it is replaced by the shared import.

Replace the `density` function with the kernel-driven version (keep `lowerBound`/`upperBound`/`trimZeroTails`/`buildSamplePoints` unchanged):

```ts
function density(d: Distribution, x: number, bandwidth: number, kernel: Kernel): number {
  const a = bandwidth * kernel.sdScale; // native scale
  const w = bandwidth * kernel.radius; // window half-width in x units
  const lo = lowerBound(d, x - w);
  const hi = upperBound(d, x + w);
  let acc = 0;
  for (let i = lo; i < hi; i++) {
    acc += (d.weights[i]! / d.n) * (kernel.k((x - d.values[i]!) / a) / a);
  }
  return Math.abs(acc) < ZERO ? 0 : acc;
}
```

- [ ] **Step 5: Run the full KDE test file to verify it passes**

Run: `cd packages/distribu-tron && pnpm vitest run src/kde.spec.ts`
Expected: PASS — updated + new tests all green.

- [ ] **Step 6: Commit**

```bash
git add packages/distribu-tron/src/kde.ts packages/distribu-tron/src/kde.spec.ts
git commit -m "feat(kde): kernel-driven density with gaussian default and SD bandwidth"
```

---

## Task 5: `groupedKde` — scott-aware shared bandwidth, kernel forwarded

**Files:**
- Modify: `src/group.ts`
- Modify: `src/group-consumers.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/group-consumers.spec.ts`. Ensure the file imports `group`, `groupedKde` (from `./group`), `distribution` (from `./distribution`), `scottBandwidth` (from `./kde`), and `stdev` (from `./descriptives`) — add any missing names to the existing imports. Then append this block at the end of the file:

```ts
describe("groupedKde kernels & bandwidth", () => {
  // Overall distribution here is heavy-tailed: IQR/1.349 << stdev, so Scott (stdev-only) and
  // Silverman (robust min) give clearly different bandwidths — making the Scott path observable.
  const rows = [
    { g: "a", v: 0, w: 5 }, { g: "a", v: 1, w: 5 },
    { g: "b", v: 1, w: 5 }, { g: "b", v: 20, w: 1 },
  ];
  const gd = group(rows, { by: "g", value: "v", weight: "w" });

  it("forwards the kernel option to every series", () => {
    const gauss = groupedKde(gd, { bandwidth: 1, kernel: "gaussian" });
    const epan = groupedKde(gd, { bandwidth: 1, kernel: "epanechnikov" });
    // same grid, but different kernels ⇒ different densities somewhere
    expect(gauss.length).toBe(epan.length);
    const differs = gauss.some((p, i) => Math.abs(p.density - epan[i]!.density) > 1e-9);
    expect(differs).toBe(true);
  });

  it("derives the shared bandwidth via Scott when bandwidth: 'scott'", () => {
    // The named "scott" path must match passing the overall's explicit Scott bandwidth as a number.
    // Before the shared-resolver fix, "scott" silently fell back to Silverman → these differ.
    const overallScott = scottBandwidth(gd.overall.n, stdev(gd.overall));
    const byName = groupedKde(gd, { bandwidth: "scott", kernel: "gaussian" });
    const byNumber = groupedKde(gd, { bandwidth: overallScott, kernel: "gaussian" });
    expect(byName.length).toBe(byNumber.length);
    for (let i = 0; i < byName.length; i++) {
      expect(byName[i]!.density).toBeCloseTo(byNumber[i]!.density, 10);
      expect(byName[i]!.x).toBeCloseTo(byNumber[i]!.x, 10);
    }
  });
});
```

- [ ] **Step 2: Run to verify the scott test fails**

Run: `cd packages/distribu-tron && pnpm vitest run src/group-consumers.spec.ts`
Expected: the kernel-forwarding test PASSES already (kernel rides `...opts` — this is a refactor guard), but the **Scott test FAILS**: `resolveSharedBandwidth` ignores `"scott"` and falls back to Silverman, so `byName` (Silverman-scale) ≠ `byNumber` (explicit Scott). This is the red that Step 3 turns green.

- [ ] **Step 3: Replace `resolveSharedBandwidth` with the shared resolver**

In `src/group.ts`:

Update the silverman import. Find:

```ts
import { silvermanFor } from "./internal/silverman";
```

Replace with:

```ts
import { resolveBandwidth } from "./internal/silverman";
```

In `groupedKde`, find:

```ts
  const bandwidth = resolveSharedBandwidth(gd.overall, opts.bandwidth);
```

Replace with:

```ts
  const bandwidth = resolveBandwidth(gd.overall, opts.bandwidth);
```

Delete the now-unused private helper:

```ts
function resolveSharedBandwidth(overall: Distribution, bw: KdeOptions["bandwidth"]): number {
  // Manual bandwidth passes through; otherwise derive Silverman once from the overall
  return typeof bw === "number" ? bw : silvermanFor(overall);
}
```

(If removing it leaves `Distribution` or `KdeOptions` imported-but-unused in `group.ts`, leave them — they are used elsewhere in the file. If Biome flags an unused import after the change, remove only the specific unused name.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/distribu-tron && pnpm vitest run src/group-consumers.spec.ts`
Expected: PASS — kernel forwarding + scott shared bandwidth green.

- [ ] **Step 5: Commit**

```bash
git add packages/distribu-tron/src/group.ts packages/distribu-tron/src/group-consumers.spec.ts
git commit -m "feat(kde): groupedKde shares the scott-aware bandwidth resolver"
```

---

## Task 6: Public barrel — export `scottBandwidth`

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.spec.ts`

- [ ] **Step 1: Write the failing test**

In `src/index.spec.ts`, add an assertion that the new public symbol is exported (match the file's existing import/assertion style; example):

```ts
import { scottBandwidth } from "./index";

it("exports scottBandwidth", () => {
  expect(typeof scottBandwidth).toBe("function");
  expect(scottBandwidth(100, 2)).toBeCloseTo(1.06 * 2 * Math.pow(100, -0.2), 12);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/distribu-tron && pnpm vitest run src/index.spec.ts`
Expected: FAIL — `scottBandwidth` not exported from `./index`.

- [ ] **Step 3: Export it from the barrel**

In `src/index.ts`, find:

```ts
export { kde, silvermanBandwidth } from "./kde";
```

Replace with:

```ts
export { kde, silvermanBandwidth, scottBandwidth } from "./kde";
```

(The `KdeKernel` type is already re-exported via `export type * from "./types";`.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/distribu-tron && pnpm vitest run src/index.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/distribu-tron/src/index.ts packages/distribu-tron/src/index.spec.ts
git commit -m "feat(kde): export scottBandwidth from the public barrel"
```

---

## Task 7: Docs (README), benchmark, and full verification

**Files:**
- Modify: `README.md` (root — **edit the root only**; the package copy is generated at pack time)
- Create/modify: `bench/kde.bench.ts`

- [ ] **Step 1: Update the README KDE section**

In the root `README.md`, locate the KDE/`kde` documentation and update it to describe the new behavior. Add (adapt wording to the surrounding style):

- `kde(d)` now uses the **gaussian** kernel by default (smooth output).
- `kernel` accepts `"gaussian" | "epanechnikov" | "triangular" | "cosine"`.
- `bandwidth` is the **kernel standard deviation**; a numeric value means the same smoothing across kernels. `"silverman"` (default) and `"scott"` select data-driven bandwidths.
- A short **migration note**: numeric bandwidths now mean SD, not the Epanechnikov half-width (`h_new = h_old / √5` reproduces the old Epanechnikov curve); the default kernel changed from Epanechnikov to Gaussian. We are at `0.1.0-beta`, so this lands before stable.

- [ ] **Step 2: Add a per-kernel benchmark (comparison only, no asserts)**

Create or extend `bench/kde.bench.ts` (match the existing `bench/*.bench.ts` structure — vitest `bench`):

```ts
import { bench, describe } from "vitest";
import { distribution } from "../src/distribution";
import { kde } from "../src/kde";
import type { KdeKernel } from "../src/types";

const d = distribution(
  Array.from({ length: 2000 }, (_, i) => ({ value: i % 200, weight: 1 + (i % 7) })),
);

describe("kde kernels", () => {
  for (const kernel of ["gaussian", "epanechnikov", "triangular", "cosine"] as KdeKernel[]) {
    bench(kernel, () => {
      kde(d, { kernel, resolution: 256 });
    });
  }
});
```

- [ ] **Step 3: Full gate — lint, typecheck, test, build**

Run, from `packages/distribu-tron/`:

```bash
cd packages/distribu-tron && pnpm lint && pnpm tsc --noEmit && pnpm vitest run && pnpm build
```

Expected: all green. (`pnpm bench` is optional and comparison-only.)

- [ ] **Step 4: Commit**

```bash
git add README.md packages/distribu-tron/bench/kde.bench.ts
git commit -m "docs(kde): document kernels + scott; add per-kernel benchmark"
```

---

## Notes for the executor

- **`bandwidth` is the standard deviation now.** Every kernel maps SD → its native scale via `sdScale`. Do not reintroduce "bandwidth = half-width" anywhere.
- **One shared `resolveBandwidth`** lives in `internal/silverman.ts` and is used by both `kde.ts` and `group.ts`. Never re-add a local bandwidth-resolution branch — the codebase previously drifted on a duplicated Silverman formula.
- **Gaussian is windowed at ±4σ.** That is why `density()` uses `kernel.radius` (4 for gaussian, `√5`/`√6`/`≈2.298` for the compact kernels) rather than a fixed `±h`.
- **Don't touch `internal/ticks.ts`** (vendored d3, ISC) or the sample-grid logic — resolution is intentionally unchanged.
- **Degenerate contracts are unchanged:** empty/zero-mass → `[]`; bandwidth ≤ 0 → `[]`. Keep them.
- This branch updates the root `README` only; the docs site (`apps/docs`) is updated later on `feat/docs-site`.
```
