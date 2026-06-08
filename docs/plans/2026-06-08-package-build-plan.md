# distribu-tron — Package Build Plan (Stage 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish v1 of `distribu-tron` — a fast, zero-runtime-dependency, ESM-only TypeScript library for weighted/pre-aggregated distribution statistics — in its own new repository.

**Architecture:** A `distribution()` factory normalizes any supported input into a prepared `Distribution` (sorted, distinct, `Float64Array` substrate + cumulative weights). Tree-shakeable free functions read that substrate: descriptives, quantiles/box-plot, ECDF, histogram, KDE. A `group()` layer produces per-group distributions with hierarchical `ROLLUP` subtotals and shared-domain plot helpers. Numerically stable (Neumaier) summation throughout. Core is measurement-free; a `tinybench` suite supplies advertised numbers.

**Tech Stack:** TypeScript, pnpm workspace, `tsup` (ESM-only), Vitest, tinybench, GitHub Actions. Node ≥ 22 (dev on 24).

**Spec:** `docs/superpowers/specs/2026-06-08-distribu-tron-package-design.md` (lives in the rayfin app repo; Task 1 copies it into the new repo's `docs/`).

**Stage 2 (separate, later plan):** once published, swap `rayfin-distribution-stats` over to consume the package. Not in this plan.

---

## Conventions

- **Where you work:** a brand-new repo at a sibling path, default `C:\Repos\distribu-tron` (confirm/adjust at execution). All paths below are relative to that repo root unless absolute.
- **No Microsoft copyright header** — this is a new MIT-licensed OSS package by the user (not the Microsoft-owned app). Source files need no license banner except `ticks.ts`, which keeps the ISC attribution for the vendored d3 code.
- **Tests:** `import { describe, it, expect } from "vitest";` Run one file: `pnpm vitest run <path>` from `packages/distribu-tron`. Run all: `pnpm -C packages/distribu-tron test`.
- **Commits:** the user handles commits — each task ends with a suggested message; run it only if asked, otherwise leave the work staged.
- **TDD:** every behavioral task is failing test → run-to-fail → implement → run-to-pass.
- **Field name is `weight`** (fractional allowed), never `count`. `value`/`weight` are the core fields.

---

## File structure (package: `packages/distribu-tron/`)

| File | Responsibility |
|---|---|
| `src/types.ts` | All public types: `WeightedValue`, `DistributionInput`, `Distribution`, `PrepTimings`, options, output shapes, grouping types |
| `src/internal/sum.ts` | `neumaierSum`, `neumaierSumMap` — numerically stable summation |
| `src/internal/ticks.ts` | Vendored d3 `ticks`/`tickIncrement`/`nice` (ISC) |
| `src/distribution.ts` | `distribution()` factory (parse/validate/aggregate/sort/cumulative/profile) |
| `src/descriptives.ts` | `mean`, `sum`, `min`, `max`, `range`, `variance`, `stdev`, `mode`, `mad`, `skewness`, `kurtosis` |
| `src/quantiles.ts` | `quantile`, `median`, `quartiles`, `percentileRank`, `boxplot` |
| `src/ecdf.ts` | `ecdf`, `cdf` |
| `src/histogram.ts` | `histogram` (FD + cap + explicit edges), `DEFAULT_MAX_AUTO_BINS` |
| `src/kde.ts` | `kde`, `silvermanBandwidth` |
| `src/summary.ts` | `summary` |
| `src/profile.ts` | `time` |
| `src/group.ts` | `group`, `summarize`, `groupedHistogram`, `groupedKde` |
| `src/index.ts` | Public barrel |
| `bench/*.bench.ts` | tinybench comparisons |

Repo root: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.gitignore`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`; reserved empty dirs `docs/`, `playground/`.

---

## Task 1: Verify name, create the repo & workspace scaffold

**Files (create):** repo root files + `packages/distribu-tron/` package shell.

- [ ] **Step 1: Verify the npm name is free**

Run: `npm view distribu-tron version`
Expected: `npm error 404` (name available). If it resolves to a version, STOP and ask the user to choose a scope (e.g. `@dmp/distribu-tron`); use that as `name` everywhere below.

- [ ] **Step 2: Create the repo and base folders**

```bash
mkdir -p /c/Repos/distribu-tron/packages/distribu-tron/src/internal
cd /c/Repos/distribu-tron
git init
mkdir -p docs playground bench .github/workflows packages/distribu-tron/bench
```

- [ ] **Step 3: Root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "docs"
  - "playground"
```

`package.json` (root, private):
```json
{
  "name": "distribu-tron-workspace",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "pnpm -C packages/distribu-tron build",
    "test": "pnpm -C packages/distribu-tron test",
    "lint": "pnpm -C packages/distribu-tron lint",
    "typecheck": "pnpm -C packages/distribu-tron typecheck",
    "bench": "pnpm -C packages/distribu-tron bench"
  }
}
```

`.gitignore`:
```
node_modules
dist
coverage
*.tsbuildinfo
.DS_Store
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Package manifest & configs**

`packages/distribu-tron/package.json` (use the scoped name from Step 1 if needed):
```json
{
  "name": "distribu-tron",
  "version": "0.0.0",
  "description": "Fast, weighted, plot-ready distribution statistics from a frequency table.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "types": "./dist/index.d.ts",
  "module": "./dist/index.js",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "bench": "vitest bench --run"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "d3-array": "^3.2.4",
    "simple-statistics": "^7.8.9",
    "tinybench": "^3.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  }
}
```

`packages/distribu-tron/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src", "bench"]
}
```

`packages/distribu-tron/tsup.config.ts`:
```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  banner: { js: "/* distribu-tron — MIT. Includes ticks/nice from d3-array (ISC) © Mike Bostock */" },
});
```

`packages/distribu-tron/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.spec.ts"] } });
```

- [ ] **Step 5: Install and sanity-check tooling**

Run: `pnpm install`
Then: `pnpm -C packages/distribu-tron exec tsc --version`
Expected: install completes; tsc prints a 5.7.x version.

- [ ] **Step 6: Copy the design spec into the repo**

Copy `docs/superpowers/specs/2026-06-08-distribu-tron-package-design.md` from the rayfin app repo into this repo's `docs/design.md` (so the package is self-documenting).

- [ ] **Step 7: Commit (if asked)**

```bash
git add -A && git commit -m "chore: scaffold distribu-tron pnpm workspace (ESM-only, tsup, vitest)"
```

---

## Task 2: CI workflow

**Files (create):** `.github/workflows/ci.yml`

- [ ] **Step 1: Add the CI workflow**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C packages/distribu-tron typecheck
      - run: pnpm -C packages/distribu-tron test
      - run: pnpm -C packages/distribu-tron build
```

- [ ] **Step 2: Verify it parses locally (optional)**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')"`
Expected: no error (file exists/readable). Actual CI runs on push.

- [ ] **Step 3: Commit (if asked)**

```bash
git add .github/workflows/ci.yml && git commit -m "ci: typecheck + test + build on push/PR"
```

> The `release.yml` (npm publish with provenance on tag) and GH Pages workflow are added in Task 21, alongside README/publish prep.

---

## Task 3: Vendored `ticks` / `nice`

**Files:** Create `src/internal/ticks.ts`, Test `src/internal/ticks.spec.ts`

- [ ] **Step 1: Failing test**

```ts
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
  it("step", () => { expect(tickIncrement(0, 10, 5)).toBe(2); });
});
```

- [ ] **Step 2: Run → fail.** `pnpm vitest run src/internal/ticks.spec.ts`

- [ ] **Step 3: Implement** `src/internal/ticks.ts`

```ts
// Ported from d3-array (https://github.com/d3/d3-array), ISC License, © Mike Bostock.
const e10 = Math.sqrt(50);
const e5 = Math.sqrt(10);
const e2 = Math.sqrt(2);

function tickSpec(start: number, stop: number, count: number): [number, number, number] {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / Math.pow(10, power);
  const factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1: number, i2: number, inc: number;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start * inc); i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start / inc); i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

export function ticks(start: number, stop: number, count: number): number[] {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start;
  const [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1;
  const result = new Array<number>(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) result[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) result[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) result[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) result[i] = (i1 + i) * inc;
  }
  return result;
}

export function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / Math.pow(10, power);
  const factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  return power >= 0 ? factor * Math.pow(10, power) : -Math.pow(10, -power) / factor;
}

export function nice(start: number, stop: number, count: number): [number, number] {
  let prestep: number | undefined;
  for (;;) {
    const step = tickIncrement(start, stop, count);
    if (step === prestep || step === 0 || !Number.isFinite(step)) return [start, stop];
    if (step > 0) { start = Math.floor(start / step) * step; stop = Math.ceil(stop / step) * step; }
    else { start = Math.ceil(start * step) / step; stop = Math.floor(stop * step) / step; }
    prestep = step;
  }
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: vendor d3 ticks/nice (ISC)"`

---

## Task 4: Numerically stable summation

**Files:** Create `src/internal/sum.ts`, Test `src/internal/sum.spec.ts`

- [ ] **Step 1: Failing test**

```ts
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
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/internal/sum.ts`

```ts
/** Neumaier (improved Kahan) compensated sum of an array. */
export function neumaierSum(values: ArrayLike<number>): number {
  let sum = 0, c = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const t = sum + v;
    c += Math.abs(sum) >= Math.abs(v) ? (sum - t) + v : (v - t) + sum;
    sum = t;
  }
  return sum + c;
}

/** Neumaier sum over a generated sequence `at(0..count-1)` (avoids allocating a temp array). */
export function neumaierSumMap(count: number, at: (i: number) => number): number {
  let sum = 0, c = 0;
  for (let i = 0; i < count; i++) {
    const v = at(i);
    const t = sum + v;
    c += Math.abs(sum) >= Math.abs(v) ? (sum - t) + v : (v - t) + sum;
    sum = t;
  }
  return sum + c;
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: Neumaier stable summation"`

---

## Task 5: Public types

**Files:** Create `src/types.ts` (no test — types only; verified by `pnpm typecheck` in later tasks)

- [ ] **Step 1: Create the file**

```ts
export interface WeightedValue { value: number; weight: number }

export type DistributionInput =
  | WeightedValue[]
  | number[]
  | { values: ArrayLike<number>; weights?: ArrayLike<number> };

export interface DistributionOptions { sorted?: boolean; profile?: boolean }

export interface PrepTimings { validateMs: number; aggregateMs: number; sortMs: number; totalMs: number }

export interface Distribution {
  readonly size: number;
  readonly n: number;
  readonly min: number;
  readonly max: number;
  readonly values: Float64Array;
  readonly weights: Float64Array;
  readonly cumulative: Float64Array; // running Σ weight; cumulative[i] = Σ_{j<=i} weights[j]
  readonly timings?: PrepTimings;
}

export type QuantileMethod = "linear" | "lower" | "higher" | "nearest" | "midpoint";

export interface SummaryStatistics {
  n: number; size: number; mean: number; stdev: number; min: number; max: number;
  range: number; mode: number; mad: number; skewness: number; kurtosis: number;
  q1: number; median: number; q3: number; iqr: number;
}

export interface Bin { x0: number; x1: number; weight: number }
export interface KdePoint { x: number; density: number }
export interface EcdfPoint { x: number; p: number }

export interface BoxplotResult {
  min: number; q1: number; median: number; q3: number; max: number;
  iqr: number; lowerFence: number; upperFence: number; outliers: number[];
}

export interface HistogramOptions {
  binCount?: number;
  maxBins?: number;
  rule?: "fd";
  edges?: number[];
}

export interface KdeOptions {
  bandwidth?: number | "silverman";
  resolution?: number;
  clamp?: boolean;
  samplePoints?: ArrayLike<number>;
  kernel?: "epanechnikov";
}

// --- grouping ---
export type GroupKeyValue = string | number | null;
export type Accessor<T> = string | ((row: Record<string, unknown>) => T);

export interface GroupSpec {
  by: string | string[];
  value: Accessor<number>;
  weight?: Accessor<number>;
  rollup?: boolean;
  totalLabel?: string | null;
  sorted?: boolean;
}

export interface DistributionGroup {
  readonly key: Record<string, GroupKeyValue>;
  readonly level: string[];   // dimensions active (not rolled up)
  readonly depth: number;     // level.length
  readonly distribution: Distribution;
}

export interface GroupedDistribution {
  readonly dimensions: string[];
  readonly groups: DistributionGroup[];
  readonly leaves: DistributionGroup[];
  readonly overall: Distribution;
}
```

- [ ] **Step 2: Commit (if asked)** `git commit -m "feat: public types"`

---

## Task 6: `distribution()` factory

**Files:** Create `src/distribution.ts`, Test `src/distribution.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";

describe("distribution", () => {
  it("builds from a frequency table (sorted, distinct, cumulative)", () => {
    const d = distribution([{ value: 3, weight: 1 }, { value: 1, weight: 2 }, { value: 2, weight: 5 }]);
    expect(Array.from(d.values)).toEqual([1, 2, 3]);
    expect(Array.from(d.weights)).toEqual([2, 5, 1]);
    expect(Array.from(d.cumulative)).toEqual([2, 7, 8]);
    expect(d.n).toBe(8); expect(d.size).toBe(3); expect(d.min).toBe(1); expect(d.max).toBe(3);
  });
  it("aggregates raw number[] (weight 1 each, merged)", () => {
    const d = distribution([5, 1, 5, 5, 1]);
    expect(Array.from(d.values)).toEqual([1, 5]);
    expect(Array.from(d.weights)).toEqual([2, 3]);
  });
  it("accepts columnar / TypedArray", () => {
    const d = distribution({ values: Float64Array.from([10, 20]), weights: Float64Array.from([3, 4]) });
    expect(Array.from(d.values)).toEqual([10, 20]);
    expect(d.n).toBe(7);
  });
  it("merges duplicate values in a table", () => {
    const d = distribution([{ value: 1, weight: 2 }, { value: 1, weight: 3 }]);
    expect(Array.from(d.values)).toEqual([1]);
    expect(Array.from(d.weights)).toEqual([5]);
  });
  it("sorted:true trusts order and skips aggregation", () => {
    const d = distribution([{ value: 1, weight: 2 }, { value: 2, weight: 3 }], { sorted: true });
    expect(Array.from(d.values)).toEqual([1, 2]);
  });
  it("rejects negative / non-finite", () => {
    expect(() => distribution([{ value: 1, weight: -1 }])).toThrow(RangeError);
    expect(() => distribution([{ value: NaN, weight: 1 }])).toThrow(RangeError);
  });
  it("empty distribution is valid", () => {
    const d = distribution([]);
    expect(d.size).toBe(0); expect(d.n).toBe(0);
    expect(d.min).toBe(Infinity); expect(d.max).toBe(-Infinity);
  });
  it("profile attaches prep timings when asked", () => {
    const d = distribution([3, 1, 2], { profile: true });
    expect(d.timings?.totalMs).toBeGreaterThanOrEqual(0);
    expect(distribution([1]).timings).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/distribution.ts`

```ts
import type { Distribution, DistributionInput, DistributionOptions, PrepTimings, WeightedValue } from "./types";

function isColumnar(x: DistributionInput): x is { values: ArrayLike<number>; weights?: ArrayLike<number> } {
  return !Array.isArray(x) && typeof x === "object" && x !== null && "values" in x;
}

/** Pull (value, weight) pairs out of any supported input, validating as we go. */
function toPairs(input: DistributionInput): { values: number[]; weights: number[] } {
  const values: number[] = [];
  const weights: number[] = [];
  const pushPair = (v: number, w: number) => {
    if (!Number.isFinite(v)) throw new RangeError(`value must be finite, got ${v}`);
    if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError(`weight must be a finite, non-negative number, got ${w}`);
    values.push(v); weights.push(w);
  };
  if (isColumnar(input)) {
    const vs = input.values, ws = input.weights;
    for (let i = 0; i < vs.length; i++) pushPair(vs[i]!, ws ? ws[i]! : 1);
  } else {
    for (const item of input as Array<number | WeightedValue>) {
      if (typeof item === "number") pushPair(item, 1);
      else pushPair(item.value, item.weight);
    }
  }
  return { values, weights };
}

export function distribution(input: DistributionInput, options: DistributionOptions = {}): Distribution {
  const t0 = options.profile ? performance.now() : 0;

  const { values: rawV, weights: rawW } = toPairs(input);
  const t1 = options.profile ? performance.now() : 0;

  let values: Float64Array, weights: Float64Array;
  let aggregateMs = 0;
  let sortMs = 0;
  if (options.sorted) {
    // Caller guarantees ascending & distinct: no aggregate, no sort (both phases stay 0).
    values = Float64Array.from(rawV);
    weights = Float64Array.from(rawW);
  } else {
    // Aggregate duplicates into a map...
    const merged = new Map<number, number>();
    for (let i = 0; i < rawV.length; i++) merged.set(rawV[i]!, (merged.get(rawV[i]!) ?? 0) + rawW[i]!);
    const tAgg = options.profile ? performance.now() : 0;
    // ...then sort the distinct keys and materialize the substrate.
    const keys = Array.from(merged.keys()).sort((a, b) => a - b);
    values = Float64Array.from(keys);
    weights = Float64Array.from(keys, (k) => merged.get(k)!);
    if (options.profile) { aggregateMs = tAgg - t1; sortMs = performance.now() - tAgg; }
  }

  const size = values.length;
  const cumulative = new Float64Array(size);
  let running = 0;
  for (let i = 0; i < size; i++) { running += weights[i]!; cumulative[i] = running; }

  const timings: PrepTimings | undefined = options.profile
    ? { validateMs: t1 - t0, aggregateMs, sortMs, totalMs: performance.now() - t0 }
    : undefined;

  return {
    size,
    n: running,
    min: size ? values[0]! : Infinity,
    max: size ? values[size - 1]! : -Infinity,
    values, weights, cumulative,
    ...(timings ? { timings } : {}),
  };
}
```

> Note: `aggregateMs` (Map dedup) and `sortMs` (key sort + substrate materialization) are timed separately via the `tAgg` checkpoint, so `PrepTimings` carries accurate per-phase numbers. The `sorted: true` fast path skips both, leaving each at 0.

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: distribution() factory"`

---

## Task 7: Descriptives — mean/sum/min/max/range

**Files:** Create `src/descriptives.ts`, Test `src/descriptives.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { mean, sum, min, max, range } from "./descriptives";

const d = distribution([{ value: 1, weight: 3 }, { value: 2, weight: 2 }, { value: 3, weight: 1 }]);

describe("descriptives basics", () => {
  it("sum / mean over the weighted population", () => {
    expect(sum(d)).toBe(10);            // 1*3 + 2*2 + 3*1
    expect(mean(d)).toBeCloseTo(10 / 6, 12);
  });
  it("min / max / range", () => {
    expect(min(d)).toBe(1); expect(max(d)).toBe(3); expect(range(d)).toBe(2);
  });
  it("empty → NaN-ish", () => {
    const e = distribution([]);
    expect(Number.isNaN(mean(e))).toBe(true);
    expect(min(e)).toBe(Infinity);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/descriptives.ts` (this file grows in Tasks 8–9)

```ts
import type { Distribution } from "./types";
import { neumaierSumMap } from "./internal/sum";

/** Σ value·weight. */
export function sum(d: Distribution): number {
  return neumaierSumMap(d.size, (i) => d.values[i]! * d.weights[i]!);
}

export function mean(d: Distribution): number {
  return d.n > 0 ? sum(d) / d.n : NaN;
}

export function min(d: Distribution): number { return d.min; }
export function max(d: Distribution): number { return d.max; }
export function range(d: Distribution): number {
  return d.size ? d.max - d.min : NaN;
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: descriptives mean/sum/min/max/range"`

---

## Task 8: Descriptives — variance / stdev

**Files:** Modify `src/descriptives.ts`, Test add to `src/descriptives.spec.ts`

- [ ] **Step 1: Failing test (append)**

```ts
import { variance, stdev } from "./descriptives";

describe("variance / stdev", () => {
  it("population by default (÷n)", () => {
    // values 2,4,4,4,5,5,7,9 (n=8): population variance 4, stdev 2
    const d = distribution([{ value: 2, weight: 1 }, { value: 4, weight: 3 }, { value: 5, weight: 2 }, { value: 7, weight: 1 }, { value: 9, weight: 1 }]);
    expect(variance(d)).toBeCloseTo(4, 10);
    expect(stdev(d)).toBeCloseTo(2, 10);
  });
  it("sample uses n-1", () => {
    const d = distribution([{ value: 0, weight: 1 }, { value: 10, weight: 1 }]);
    expect(variance(d, { sample: true })).toBeCloseTo(50, 10); // ((0-5)^2+(10-5)^2)/(2-1)
  });
  it("degenerate → 0", () => {
    expect(stdev(distribution([{ value: 7, weight: 5 }]))).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement (append to `src/descriptives.ts`)**

```ts
function centralMoment(d: Distribution, m: number, mu: number): number {
  return neumaierSumMap(d.size, (i) => d.weights[i]! * Math.pow(d.values[i]! - mu, m));
}

export function variance(d: Distribution, opts: { sample?: boolean } = {}): number {
  if (d.size === 0) return NaN;
  if (d.n <= (opts.sample ? 1 : 0)) return 0;
  const mu = mean(d);
  const ss = centralMoment(d, 2, mu);
  const denom = opts.sample ? d.n - 1 : d.n;
  const v = ss / denom;
  return v > 0 && Number.isFinite(v) ? v : 0;
}

export function stdev(d: Distribution, opts: { sample?: boolean } = {}): number {
  return Math.sqrt(variance(d, opts));
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: weighted variance/stdev (population default)"`

---

## Task 9: Descriptives — mode / mad / skewness / kurtosis

**Files:** Modify `src/descriptives.ts`, Test add to `src/descriptives.spec.ts`. `mad` needs `median` — implement a small internal weighted-median helper here to avoid a circular dep with quantiles (quantiles will reuse it in Task 10).

- [ ] **Step 1: Failing test (append)**

```ts
import { mode, mad, skewness, kurtosis } from "./descriptives";

describe("mode/mad/skewness/kurtosis", () => {
  it("mode = max-weight value (ties → smallest)", () => {
    expect(mode(distribution([{ value: 5, weight: 2 }, { value: 8, weight: 9 }, { value: 9, weight: 9 }]))).toBe(8);
  });
  it("mad = weighted median of |x - median|", () => {
    // values 1,2,3,4,5 each weight 1: median 3, deviations 2,1,0,1,2 → median 1
    const d = distribution([1, 2, 3, 4, 5]);
    expect(mad(d)).toBe(1);
  });
  it("symmetric data → ~0 skew", () => {
    const d = distribution([1, 2, 3, 4, 5]);
    expect(skewness(d)).toBeCloseTo(0, 12);
  });
  it("excess kurtosis of all-equal → 0 (degenerate)", () => {
    expect(kurtosis(distribution([{ value: 4, weight: 10 }]))).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement (append to `src/descriptives.ts`)**

```ts
/** Weighted median of sorted-distinct (values, weights) — shared by mad and quantiles. */
export function weightedMedianSorted(values: ArrayLike<number>, cumulative: ArrayLike<number>, n: number): number {
  const size = values.length;
  if (size === 0 || n <= 0) return NaN;
  const target = n / 2;
  for (let i = 0; i < size; i++) if (cumulative[i]! >= target) return values[i]!;
  return values[size - 1]!;
}

export function mode(d: Distribution): number {
  if (d.size === 0) return NaN;
  let best = 0;
  for (let i = 1; i < d.size; i++) if (d.weights[i]! > d.weights[best]!) best = i; // first max = smallest value
  return d.values[best]!;
}

export function mad(d: Distribution): number {
  if (d.size === 0) return NaN;
  const med = weightedMedianSorted(d.values, d.cumulative, d.n);
  // Build sorted (deviation, weight) pairs, then weighted median.
  const pairs = Array.from({ length: d.size }, (_, i) => [Math.abs(d.values[i]! - med), d.weights[i]!] as const)
    .sort((a, b) => a[0] - b[0]);
  let cum = 0; const target = d.n / 2;
  for (const [dev, w] of pairs) { cum += w; if (cum >= target) return dev; }
  return pairs.length ? pairs[pairs.length - 1]![0] : NaN;
}

export function skewness(d: Distribution): number {
  if (d.size === 0) return NaN;
  const mu = mean(d);
  const m2 = centralMoment(d, 2, mu) / d.n;
  if (!(m2 > 0)) return 0;
  const m3 = centralMoment(d, 3, mu) / d.n;
  return m3 / Math.pow(m2, 1.5);
}

export function kurtosis(d: Distribution): number {
  if (d.size === 0) return NaN;
  const mu = mean(d);
  const m2 = centralMoment(d, 2, mu) / d.n;
  if (!(m2 > 0)) return 0;
  const m4 = centralMoment(d, 4, mu) / d.n;
  return m4 / (m2 * m2) - 3; // excess
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: mode/mad/skewness/kurtosis"`

---

## Task 10: Quantiles — quantile / median / quartiles / percentileRank

**Files:** Create `src/quantiles.ts`, Test `src/quantiles.spec.ts`

The weighted quantile reduces to standard type-7 when all weights are 1. `valueAtRank(r)` maps an expanded 0-indexed rank `r ∈ [0, n-1]` to a distinct value via cumulative weights.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { quantile, median, quartiles, percentileRank } from "./quantiles";

describe("quantile (linear default reduces to type-7 for unit weights)", () => {
  const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9]); // n=9
  it("median / quartiles", () => {
    expect(median(d)).toBe(5);
    expect(quartiles(d)).toEqual({ q1: 3, q2: 5, q3: 7, iqr: 4 });
  });
  it("linear interpolates between order stats", () => {
    const d2 = distribution([10, 20, 30, 40]); // n=4, type-7 median = 25
    expect(quantile(d2, 0.5)).toBeCloseTo(25, 12);
  });
  it("methods", () => {
    const d2 = distribution([10, 20, 30, 40]);
    expect(quantile(d2, 0.5, { method: "lower" })).toBe(20);
    expect(quantile(d2, 0.5, { method: "higher" })).toBe(30);
    expect(quantile(d2, 0.5, { method: "midpoint" })).toBe(25);
  });
  it("respects weights", () => {
    // value 1 weight 1, value 100 weight 99 → median pulled toward 100
    const dw = distribution([{ value: 1, weight: 1 }, { value: 100, weight: 99 }]);
    expect(quantile(dw, 0.5, { method: "lower" })).toBe(100);
  });
  it("p out of range throws", () => {
    expect(() => quantile(d, 1.5)).toThrow(RangeError);
  });
});

describe("percentileRank", () => {
  it("proportion of weight <= value", () => {
    const d = distribution([1, 2, 3, 4]); // n=4
    expect(percentileRank(d, 2)).toBeCloseTo(0.5, 12);
    expect(percentileRank(d, 4)).toBe(1);
    expect(percentileRank(d, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/quantiles.ts`

```ts
import type { Distribution, QuantileMethod } from "./types";

/** First index whose cumulative weight is strictly greater than `r` (expanded rank). */
function indexAtRank(d: Distribution, r: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (d.cumulative[mid]! <= r) lo = mid + 1; else hi = mid; }
  return Math.min(lo, d.size - 1);
}
function valueAtRank(d: Distribution, r: number): number {
  const clamped = Math.max(0, Math.min(r, d.n - 1));
  return d.values[indexAtRank(d, clamped)]!;
}

export function quantile(d: Distribution, p: number, opts: { method?: QuantileMethod } = {}): number {
  if (p < 0 || p > 1) throw new RangeError(`p must be in [0,1], got ${p}`);
  if (d.size === 0 || d.n <= 0) return NaN;
  if (d.size === 1) return d.values[0]!;
  const method = opts.method ?? "linear";
  const h = p * (d.n - 1);            // 0-indexed expanded rank
  const lo = Math.floor(h);
  const frac = h - lo;
  switch (method) {
    case "lower": return valueAtRank(d, lo);
    case "higher": return valueAtRank(d, Math.ceil(h));
    case "nearest": return valueAtRank(d, Math.round(h));
    case "midpoint": return (valueAtRank(d, lo) + valueAtRank(d, Math.ceil(h))) / 2;
    case "linear":
    default: {
      const vLo = valueAtRank(d, lo);
      if (frac === 0) return vLo;
      const vHi = valueAtRank(d, lo + 1);
      return vLo + frac * (vHi - vLo);
    }
  }
}

export function median(d: Distribution): number { return quantile(d, 0.5); }

export function quartiles(d: Distribution): { q1: number; q2: number; q3: number; iqr: number } {
  const q1 = quantile(d, 0.25), q2 = quantile(d, 0.5), q3 = quantile(d, 0.75);
  return { q1, q2, q3, iqr: q3 - q1 };
}

/** P(X ≤ value): cumulative weight of all values ≤ `value`, divided by n. */
export function percentileRank(d: Distribution, value: number): number {
  if (d.size === 0 || d.n <= 0) return NaN;
  let lo = 0, hi = d.size; // first index with values[i] > value
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (d.values[mid]! <= value) lo = mid + 1; else hi = mid; }
  const cum = lo === 0 ? 0 : d.cumulative[lo - 1]!;
  return cum / d.n;
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: weighted quantiles (type-7 linear default) + percentileRank"`

---

## Task 11: Box-plot stats

**Files:** Create `src/boxplot.ts`, Test `src/boxplot.spec.ts`. (Kept separate from quantiles for focus; re-exported via the barrel.)

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { boxplot } from "./boxplot";

describe("boxplot", () => {
  it("fences + outliers (1.5·IQR)", () => {
    // 1..10 plus a far outlier 100
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/boxplot.ts`

```ts
import type { BoxplotResult, Distribution } from "./types";
import { quartiles } from "./quantiles";

export function boxplot(d: Distribution, opts: { whisker?: number } = {}): BoxplotResult {
  const k = opts.whisker ?? 1.5;
  const { q1, q2, q3, iqr } = quartiles(d);
  const lowerFence = q1 - k * iqr;
  const upperFence = q3 + k * iqr;
  const outliers: number[] = [];
  for (let i = 0; i < d.size; i++) {
    const v = d.values[i]!;
    if (v < lowerFence || v > upperFence) outliers.push(v);
  }
  return { min: d.min, q1, median: q2, q3, max: d.max, iqr, lowerFence, upperFence, outliers };
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: boxplot stats with IQR fences"`

---

## Task 12: ECDF / CDF

**Files:** Create `src/ecdf.ts`, Test `src/ecdf.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { ecdf, cdf } from "./ecdf";

describe("ecdf / cdf", () => {
  it("step points reaching 1", () => {
    const d = distribution([1, 2, 3, 4]); // n=4
    expect(ecdf(d)).toEqual([
      { x: 1, p: 0.25 }, { x: 2, p: 0.5 }, { x: 3, p: 0.75 }, { x: 4, p: 1 },
    ]);
  });
  it("cdf is the step value at x", () => {
    const d = distribution([1, 2, 3, 4]);
    expect(cdf(d, 2.5)).toBe(0.5);
    expect(cdf(d, 0)).toBe(0);
    expect(cdf(d, 99)).toBe(1);
  });
  it("empty → []", () => { expect(ecdf(distribution([]))).toEqual([]); });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/ecdf.ts`

```ts
import type { Distribution, EcdfPoint } from "./types";
import { percentileRank } from "./quantiles";

export function ecdf(d: Distribution): EcdfPoint[] {
  const out: EcdfPoint[] = new Array(d.size);
  for (let i = 0; i < d.size; i++) out[i] = { x: d.values[i]!, p: d.cumulative[i]! / d.n };
  return out;
}

export function cdf(d: Distribution, value: number): number {
  return percentileRank(d, value);
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: ecdf/cdf"`

---

## Task 13: Histogram

**Files:** Create `src/histogram.ts`, Test `src/histogram.spec.ts`. Ports the seed's capped Freedman–Diaconis + round-step-up logic to the `Distribution` substrate and adds the explicit `edges` seam.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { histogram, DEFAULT_MAX_AUTO_BINS } from "./histogram";
import type { Bin } from "./types";

const total = (b: Bin[]) => b.reduce((s, x) => s + x.weight, 0);
const skewed = distribution([
  ...Array.from({ length: 101 }, (_, i) => ({ value: i * 4, weight: 1 })),
  { value: 6000, weight: 1 },
]);

describe("histogram", () => {
  it("empty → []", () => { expect(histogram(distribution([]))).toEqual([]); });
  it("weights are conserved", () => {
    const d = distribution([{ value: 1, weight: 2 }, { value: 5, weight: 9 }, { value: 9, weight: 4 }]);
    expect(total(histogram(d))).toBe(15);
  });
  it("auto bin count is capped on skewed data", () => {
    const bins = histogram(skewed);
    expect(bins.length).toBeLessThanOrEqual(DEFAULT_MAX_AUTO_BINS);
    expect(bins.length).toBeGreaterThan(1);
    expect(total(bins)).toBe(skewed.n);
  });
  it("explicit edges override the rule", () => {
    const d = distribution([1, 5, 9]);
    const bins = histogram(d, { edges: [0, 5, 10] });
    expect(bins.map((b) => [b.x0, b.x1])).toEqual([[0, 5], [5, 10]]);
    expect(total(bins)).toBe(3);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/histogram.ts`

```ts
import type { Bin, Distribution, HistogramOptions } from "./types";

export const DEFAULT_MAX_AUTO_BINS = 50;

export function histogram(d: Distribution, options: HistogramOptions = {}): Bin[] {
  if (d.size === 0) return [];
  if (d.min === d.max) return [{ x0: d.min, x1: d.max, weight: d.n }];
  const boundaries = options.edges && options.edges.length >= 2
    ? options.edges.slice().sort((a, b) => a - b)
    : computeBoundaries(d, options);
  const bins: Bin[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) bins.push({ x0: boundaries[i]!, x1: boundaries[i + 1]!, weight: 0 });
  if (bins.length === 0) return [{ x0: d.min, x1: d.max, weight: d.n }];
  assign(d, bins);
  return bins;
}

function computeBoundaries(d: Distribution, options: HistogramOptions): number[] {
  const target = options.binCount && options.binCount > 0
    ? options.binCount
    : autoBinCount(d, options.maxBins ?? DEFAULT_MAX_AUTO_BINS);
  const step = niceStep((d.max - d.min) / target);
  if (!(step > 0)) return [d.min, d.max];
  const start = Math.floor(d.min / step) * step;
  const end = Math.ceil(d.max / step) * step;
  const segments = Math.max(1, Math.round((end - start) / step));
  const out: number[] = new Array(segments + 1);
  for (let i = 0; i <= segments; i++) out[i] = start + i * step;
  return out;
}

function autoBinCount(d: Distribution, cap: number): number {
  // Freedman–Diaconis on the distinct-value count, Scott fallback when IQR is 0.
  const iqrVal = iqr(d);
  const sd = popStdev(d);
  let width: number;
  if (d.size > 1 && iqrVal > 0) width = (2 * iqrVal) / Math.cbrt(d.size);
  else if (d.size > 1 && sd > 0) width = (3.5 * sd) / Math.cbrt(d.size);
  else width = 1;
  const count = Math.max(1, Math.ceil((d.max - d.min) / width));
  return Math.min(count, Math.max(1, cap));
}

function niceStep(raw: number): number {
  if (!(raw > 0)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function assign(d: Distribution, bins: Bin[]): void {
  const last = bins.length - 1;
  let b = 0;
  for (let i = 0; i < d.size; i++) {
    const v = d.values[i]!;
    while (b < last && v >= bins[b]!.x1) b++;
    bins[b]!.weight += d.weights[i]!;
  }
}

// Local helpers so histogram has no cross-module cycle:
function iqr(d: Distribution): number {
  const q = (p: number) => { const r = Math.max(0, Math.min(p * (d.n - 1), d.n - 1)); return d.values[idx(d, r)]!; };
  return q(0.75) - q(0.25);
}
function idx(d: Distribution, r: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (d.cumulative[mid]! <= r) lo = mid + 1; else hi = mid; }
  return Math.min(lo, d.size - 1);
}
function popStdev(d: Distribution): number {
  if (d.n <= 0) return 0;
  let sum = 0; for (let i = 0; i < d.size; i++) sum += d.values[i]! * d.weights[i]!;
  const mu = sum / d.n;
  let ss = 0; for (let i = 0; i < d.size; i++) { const x = d.values[i]! - mu; ss += d.weights[i]! * x * x; }
  const v = ss / d.n;
  return v > 0 ? Math.sqrt(v) : 0;
}
```

> The small local `iqr`/`popStdev` here keep `histogram` dependency-free of `quantiles`/`descriptives` (it only needs rough values for the FD rule). If the code reviewer prefers reuse over the ~12 duplicated lines, importing `quartiles`/`stdev` is acceptable — note it but don't block.

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: capped Freedman-Diaconis histogram + explicit edges"`

---

## Task 14: KDE

**Files:** Create `src/kde.ts`, Test `src/kde.spec.ts`. Ports the seed's windowed Epanechnikov KDE to the `Distribution` substrate (using `weight`/`n`), and adds the explicit `samplePoints` seam.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { kde, silvermanBandwidth } from "./kde";

const d = distribution([
  { value: 1, weight: 2 }, { value: 2, weight: 5 }, { value: 3, weight: 9 },
  { value: 4, weight: 7 }, { value: 5, weight: 4 }, { value: 6, weight: 2 }, { value: 7, weight: 1 },
]);

function naive(x: number, h: number): number {
  let acc = 0;
  for (let i = 0; i < d.size; i++) {
    const u = (x - d.values[i]!) / h;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / h : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return acc;
}

describe("kde", () => {
  it("empty → []", () => { expect(kde(distribution([]), {})).toEqual([]); });
  it("windowed == naive at every returned point", () => {
    const pts = kde(d, { bandwidth: 1.5, clamp: false, resolution: 50 });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.density).toBeCloseTo(naive(p.x, 1.5), 6);
  });
  it("never negative", () => {
    for (const p of kde(d, { bandwidth: 1.5 })) expect(p.density).toBeGreaterThanOrEqual(0);
  });
  it("explicit samplePoints are honored", () => {
    const pts = kde(d, { bandwidth: 1.5, samplePoints: [2, 4] });
    expect(pts.map((p) => p.x)).toEqual([2, 4]);
  });
  it("silverman scales the IQR estimate by n^-1/5 when it is smaller", () => {
    // iqr/1.349 = 1 < stdev 10 → 1.06 * 1 * n^-0.2
    expect(silvermanBandwidth(100, 1.349, 10)).toBeCloseTo(1.06 * Math.pow(100, -0.2), 10);
  });
  it("silverman scales the stdev estimate by n^-1/5 when it is smaller", () => {
    // stdev 0.3 < iqr/1.349 (7.41) → 1.06 * 0.3 * n^-0.2  (regression guard: n^-0.2 must apply to stdev)
    expect(silvermanBandwidth(100, 10, 0.3)).toBeCloseTo(1.06 * 0.3 * Math.pow(100, -0.2), 12);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/kde.ts`

```ts
import type { Distribution, KdeOptions, KdePoint } from "./types";
import { ticks } from "./internal/ticks";

const ZERO = 1e-8;
const DEFAULT_RESOLUTION = 50;

export function silvermanBandwidth(n: number, iqr: number, stdev: number): number {
  // Robust Silverman rule of thumb: n^(-1/5) scales whichever spread estimate is smaller.
  return 1.06 * Math.min(iqr / 1.349, stdev) * Math.pow(n, -0.2);
}

export function kde(d: Distribution, options: KdeOptions = {}): KdePoint[] {
  if (d.size === 0 || d.n <= 0) return [];
  const bandwidth = resolveBandwidth(d, options.bandwidth);
  if (!(bandwidth > 0)) return [];
  const clamp = options.clamp ?? false;
  const sample = options.samplePoints
    ? Array.from(options.samplePoints)
    : buildSamplePoints(d.min, d.max, options.resolution ?? DEFAULT_RESOLUTION, clamp);
  const pts: KdePoint[] = sample.map((x) => ({ x, density: density(d, x, bandwidth) }));
  if (options.samplePoints) return pts; // caller controls the grid exactly
  return clamp ? pts.filter((p) => p.x >= d.min && p.x <= d.max) : trimZeroTails(pts);
}

function resolveBandwidth(d: Distribution, bw: KdeOptions["bandwidth"]): number {
  if (typeof bw === "number") return bw;
  // "silverman" (default): needs IQR + population stdev
  const q = (p: number) => { const r = Math.max(0, Math.min(p * (d.n - 1), d.n - 1)); return d.values[idx(d, r)]!; };
  const iqr = q(0.75) - q(0.25);
  let sum = 0; for (let i = 0; i < d.size; i++) sum += d.values[i]! * d.weights[i]!;
  const mu = sum / d.n;
  let ss = 0; for (let i = 0; i < d.size; i++) { const x = d.values[i]! - mu; ss += d.weights[i]! * x * x; }
  const sd = Math.sqrt(Math.max(0, ss / d.n));
  return silvermanBandwidth(d.n, iqr, sd);
}

function buildSamplePoints(min: number, max: number, resolution: number, clamp: boolean): number[] {
  const sample = ticks(min, max, resolution);
  if (sample.length === 0) return [];
  const step = sample.length > 1 ? sample[1]! - sample[0]! : 0;
  if (clamp) {
    if (sample[0]! > min) sample.unshift(min);
    if (sample[sample.length - 1]! < max) sample.push(max);
  } else if (step > 0) {
    const buffer = Math.floor(resolution / 2);
    for (let i = 0; i < buffer; i++) { sample.unshift(sample[0]! - step); sample.push(sample[sample.length - 1]! + step); }
  }
  return sample;
}

function density(d: Distribution, x: number, h: number): number {
  const lo = lowerBound(d, x - h), hi = upperBound(d, x + h);
  let acc = 0;
  for (let i = lo; i < hi; i++) {
    const u = (x - d.values[i]!) / h;
    const k = Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / h : 0;
    acc += (d.weights[i]! / d.n) * k;
  }
  return Math.abs(acc) < ZERO ? 0 : acc;
}

function lowerBound(d: Distribution, t: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.values[m]! < t) lo = m + 1; else hi = m; }
  return lo;
}
function upperBound(d: Distribution, t: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.values[m]! <= t) lo = m + 1; else hi = m; }
  return lo;
}
function idx(d: Distribution, r: number): number {
  let lo = 0, hi = d.size;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (d.cumulative[m]! <= r) lo = m + 1; else hi = m; }
  return Math.min(lo, d.size - 1);
}
function trimZeroTails(points: KdePoint[]): KdePoint[] {
  if (points.length === 0) return points;
  let s = 0;
  while (s < points.length - 1 && points[s]!.density === 0 && points[s + 1]!.density === 0) s++;
  let e = points.length - 1;
  while (e > s && points[e]!.density === 0 && points[e - 1]!.density === 0) e--;
  return points.slice(s, e + 1);
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: windowed Epanechnikov KDE + explicit samplePoints"`

---

## Task 15: `summary`

**Files:** Create `src/summary.ts`, Test `src/summary.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { distribution } from "./distribution";
import { summary } from "./summary";

describe("summary", () => {
  it("bundles scalar descriptives + quartiles", () => {
    const s = summary(distribution([1, 2, 3, 4, 5]));
    expect(s.n).toBe(5); expect(s.size).toBe(5); expect(s.median).toBe(3);
    expect(s.q1).toBe(2); expect(s.q3).toBe(4); expect(s.iqr).toBe(2);
    expect(s.min).toBe(1); expect(s.max).toBe(5); expect(s.range).toBe(4);
    expect(s.mean).toBeCloseTo(3, 12);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/summary.ts`

```ts
import type { Distribution, SummaryStatistics } from "./types";
import { mean, stdev, range, mode, mad, skewness, kurtosis } from "./descriptives";
import { quartiles } from "./quantiles";

export function summary(d: Distribution): SummaryStatistics {
  const { q1, q2, q3, iqr } = quartiles(d);
  return {
    n: d.n, size: d.size, mean: mean(d), stdev: stdev(d), min: d.min, max: d.max,
    range: range(d), mode: mode(d), mad: mad(d), skewness: skewness(d), kurtosis: kurtosis(d),
    q1, median: q2, q3, iqr,
  };
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: summary aggregator"`

---

## Task 16: `time` profiling helper

**Files:** Create `src/profile.ts`, Test `src/profile.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { time } from "./profile";

describe("time", () => {
  it("returns the value and a non-negative ms", () => {
    const r = time(() => 21 * 2);
    expect(r.value).toBe(42);
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/profile.ts`

```ts
export function time<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: time() profiling helper"`

---

## Task 17: Grouping with ROLLUP — `group()`

**Files:** Create `src/group.ts`, Test `src/group.spec.ts`

- [ ] **Step 1: Failing test**

```ts
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
    const gd = group(rows, { by: ["category", "series"], value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
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
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/group.ts`

```ts
import type {
  Accessor, Distribution, DistributionGroup, GroupSpec, GroupedDistribution, GroupKeyValue, WeightedValue,
} from "./types";
import { distribution } from "./distribution";

function acc<T>(a: Accessor<T>): (row: Record<string, unknown>) => T {
  return typeof a === "function" ? a : (row) => row[a] as T;
}

export function group(rows: ReadonlyArray<Record<string, unknown>>, spec: GroupSpec): GroupedDistribution {
  const dimensions = Array.isArray(spec.by) ? spec.by : [spec.by];
  const totalLabel = spec.totalLabel ?? null;
  const getValue = acc<number>(spec.value);
  const getWeight = spec.weight ? acc<number>(spec.weight) : () => 1;

  // 1. Bucket rows into leaf groups keyed by the full dimension tuple.
  const leafBuckets = new Map<string, { key: Record<string, GroupKeyValue>; pairs: WeightedValue[] }>();
  const allPairs: WeightedValue[] = [];
  for (const row of rows) {
    const keyObj: Record<string, GroupKeyValue> = {};
    for (const dim of dimensions) keyObj[dim] = row[dim] as GroupKeyValue;
    const id = JSON.stringify(dimensions.map((dim) => keyObj[dim]));
    let bucket = leafBuckets.get(id);
    if (!bucket) { bucket = { key: keyObj, pairs: [] }; leafBuckets.set(id, bucket); }
    const pair = { value: getValue(row), weight: getWeight(row) };
    bucket.pairs.push(pair);
    allPairs.push(pair);
  }

  const leaves: DistributionGroup[] = Array.from(leafBuckets.values()).map((b) => ({
    key: b.key,
    level: [...dimensions],
    depth: dimensions.length,
    distribution: distribution(b.pairs, { sorted: spec.sorted }),
  }));

  const overall = distribution(allPairs, { sorted: spec.sorted });

  let groups: DistributionGroup[] = leaves;
  if (spec.rollup) {
    const subtotals: DistributionGroup[] = [];
    // Prefix ROLLUP: for depth = dims-1 down to 1, group leaves by the first `depth` dims.
    for (let depth = dimensions.length - 1; depth >= 1; depth--) {
      const activeDims = dimensions.slice(0, depth);
      const buckets = new Map<string, { key: Record<string, GroupKeyValue>; pairs: WeightedValue[] }>();
      for (const b of leafBuckets.values()) {
        const key: Record<string, GroupKeyValue> = {};
        for (let i = 0; i < dimensions.length; i++) key[dimensions[i]!] = i < depth ? b.key[dimensions[i]!]! : totalLabel;
        const id = JSON.stringify(activeDims.map((dim) => key[dim]));
        let bucket = buckets.get(id);
        if (!bucket) { bucket = { key, pairs: [] }; buckets.set(id, bucket); }
        bucket.pairs.push(...b.pairs);
      }
      for (const bk of buckets.values()) {
        subtotals.push({ key: bk.key, level: activeDims, depth, distribution: distribution(bk.pairs, { sorted: spec.sorted }) });
      }
    }
    const grandKey: Record<string, GroupKeyValue> = {};
    for (const dim of dimensions) grandKey[dim] = totalLabel;
    const grand: DistributionGroup = { key: grandKey, level: [], depth: 0, distribution: overall };
    groups = [...leaves, ...subtotals, grand];
  }

  return { dimensions, groups, leaves, overall };
}
```

> Subtotals are built by concatenating child leaf pairs and letting `distribution()` merge/aggregate them — correct and simple. (A later optimization can merge pre-aggregated leaf tables instead of raw pairs; not needed for v1.)

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: group() with prefix ROLLUP subtotals"`

---

## Task 18: Grouped consumers — `summarize`, `groupedHistogram`, `groupedKde`

**Files:** Modify `src/group.ts`, Test `src/group-consumers.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { group } from "./group";
import { summarize, groupedHistogram, groupedKde } from "./group";

const rows = [
  { cat: "A", value: 1, weight: 10 }, { cat: "A", value: 5, weight: 10 },
  { cat: "B", value: 1, weight: 10 }, { cat: "B", value: 9, weight: 10 },
];

describe("grouped consumers", () => {
  it("summarize tags rows with key + depth", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const s = summarize(gd);
    expect(s.length).toBe(2);
    expect(s[0]).toHaveProperty("cat");
    expect(s[0]).toHaveProperty("depth", 1);
    expect(s[0]).toHaveProperty("median");
  });
  it("groupedHistogram shares identical edges across groups, leaves only by default", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const bins = groupedHistogram(gd);
    const aEdges = bins.filter((b) => b.cat === "A").map((b) => `${b.x0}:${b.x1}`);
    const bEdges = bins.filter((b) => b.cat === "B").map((b) => `${b.x0}:${b.x1}`);
    expect(aEdges).toEqual(bEdges);          // shared domain
    expect(bins.every((b) => b.depth === 1)).toBe(true); // leaves only
  });
  it("includeOverall adds the grand-total series", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight", rollup: true, totalLabel: "(All)" });
    const bins = groupedHistogram(gd, { includeOverall: true });
    expect(bins.some((b) => b.depth === 0)).toBe(true);
  });
  it("groupedKde shares sample points across groups", () => {
    const gd = group(rows, { by: "cat", value: "value", weight: "weight" });
    const pts = groupedKde(gd, { bandwidth: 1.5 });
    const ax = pts.filter((p) => p.cat === "A").map((p) => p.x);
    const bx = pts.filter((p) => p.cat === "B").map((p) => p.x);
    expect(ax).toEqual(bx);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement (append to `src/group.ts`)**

```ts
import type { Bin, HistogramOptions, KdeOptions, KdePoint, SummaryStatistics } from "./types";
import { histogram } from "./histogram";
import { kde } from "./kde";
import { summary } from "./summary";

type Tagged<T> = T & Record<string, GroupKeyValue> & { depth: number };

interface LevelSelect { includeSubtotals?: boolean; includeOverall?: boolean }

function selectGroups(gd: GroupedDistribution, sel: LevelSelect): DistributionGroup[] {
  const leafDepth = gd.dimensions.length;
  return gd.groups.filter((g) =>
    g.depth === leafDepth ||
    (sel.includeSubtotals && g.depth > 0 && g.depth < leafDepth) ||
    (sel.includeOverall && g.depth === 0),
  );
}

function tag<T extends object>(g: DistributionGroup, row: T): Tagged<T> {
  return { ...row, ...g.key, depth: g.depth } as Tagged<T>;
}

export function summarize(
  gd: GroupedDistribution,
  opts: LevelSelect = { includeSubtotals: true, includeOverall: true },
): Tagged<SummaryStatistics>[] {
  // Tables want every level by default; if no rollup, that's just the leaves.
  const groups = gd.groups.filter((g) =>
    g.depth === gd.dimensions.length ||
    (opts.includeSubtotals !== false && g.depth > 0 && g.depth < gd.dimensions.length) ||
    (opts.includeOverall !== false && g.depth === 0),
  );
  return groups.map((g) => tag(g, summary(g.distribution)));
}

export function groupedHistogram(
  gd: GroupedDistribution,
  opts: HistogramOptions & LevelSelect = {},
): Tagged<Bin>[] {
  // Shared edges from the overall rollup, reused for every selected group.
  const template = histogram(gd.overall, opts);
  const edges = edgesOf(template);
  const out: Tagged<Bin>[] = [];
  for (const g of selectGroups(gd, opts)) {
    for (const bin of histogram(g.distribution, { edges })) out.push(tag(g, bin));
  }
  return out;
}

export function groupedKde(
  gd: GroupedDistribution,
  opts: KdeOptions & LevelSelect = {},
): Tagged<KdePoint>[] {
  // Shared sample points + bandwidth from the overall rollup.
  const template = kde(gd.overall, opts);
  const samplePoints = template.map((p) => p.x);
  const bandwidth = resolveSharedBandwidth(gd.overall, opts.bandwidth);
  const out: Tagged<KdePoint>[] = [];
  for (const g of selectGroups(gd, opts)) {
    for (const p of kde(g.distribution, { ...opts, samplePoints, bandwidth })) out.push(tag(g, p));
  }
  return out;
}

function edgesOf(bins: Bin[]): number[] {
  if (bins.length === 0) return [];
  const edges = bins.map((b) => b.x0);
  edges.push(bins[bins.length - 1]!.x1);
  return edges;
}
function resolveSharedBandwidth(overall: Distribution, bw: KdeOptions["bandwidth"]): number {
  // Manual bandwidth passes through; otherwise derive Silverman once from the overall
  // rollup so every group's curve uses the same width (comparable across groups).
  return typeof bw === "number" ? bw : silvermanFor(overall);
}
function silvermanFor(d: Distribution): number {
  if (d.size === 0 || d.n <= 0) return 0;
  const q = (p: number) => { const r = Math.max(0, Math.min(p * (d.n - 1), d.n - 1)); let lo = 0, hi = d.size; while (lo < hi) { const m = (lo + hi) >>> 1; if (d.cumulative[m]! <= r) lo = m + 1; else hi = m; } return d.values[Math.min(lo, d.size - 1)]!; };
  const iqr = q(0.75) - q(0.25);
  let s = 0; for (let i = 0; i < d.size; i++) s += d.values[i]! * d.weights[i]!;
  const mu = s / d.n;
  let ss = 0; for (let i = 0; i < d.size; i++) { const x = d.values[i]! - mu; ss += d.weights[i]! * x * x; }
  const sd = Math.sqrt(Math.max(0, ss / d.n));
  return 1.06 * Math.min(iqr / 1.349, sd) * Math.pow(d.n, -0.2);
}
```

> **Note:** `silvermanFor` duplicates `kde.ts`'s internal Silverman derivation (~10 lines). Acceptable for v1; if the code reviewer prefers, extract a shared `internal/silverman.ts` and import it in both `kde.ts` and `group.ts`. Don't block on it.

- [ ] **Step 4: Run → pass.** **Step 5: Commit (if asked)** `git commit -m "feat: summarize + grouped histogram/kde with shared domain"`

---

## Task 19: Public barrel

**Files:** Create `src/index.ts`, Test `src/index.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import * as dt from "./index";

describe("public surface", () => {
  it("exports the v1 API", () => {
    for (const name of [
      "distribution", "mean", "sum", "min", "max", "range", "variance", "stdev",
      "mode", "mad", "skewness", "kurtosis", "quantile", "median", "quartiles",
      "percentileRank", "boxplot", "ecdf", "cdf", "histogram", "kde",
      "silvermanBandwidth", "summary", "time", "group", "summarize",
      "groupedHistogram", "groupedKde",
    ]) {
      expect(typeof (dt as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `src/index.ts`

```ts
export type * from "./types";
export { distribution } from "./distribution";
export { mean, sum, min, max, range, variance, stdev, mode, mad, skewness, kurtosis } from "./descriptives";
export { quantile, median, quartiles, percentileRank } from "./quantiles";
export { boxplot } from "./boxplot";
export { ecdf, cdf } from "./ecdf";
export { histogram, DEFAULT_MAX_AUTO_BINS } from "./histogram";
export { kde, silvermanBandwidth } from "./kde";
export { summary } from "./summary";
export { time } from "./profile";
export { group, summarize, groupedHistogram, groupedKde } from "./group";
```

- [ ] **Step 4: Run → pass.** Then `pnpm -C packages/distribu-tron typecheck` and `pnpm -C packages/distribu-tron build` — expect clean + `dist/index.js` + `dist/index.d.ts` produced. **Step 5: Commit (if asked)** `git commit -m "feat: public barrel + build"`

---

## Task 20: Benchmark suite

**Files:** Create `packages/distribu-tron/bench/quantile.bench.ts`, `bench/histogram.bench.ts`

- [ ] **Step 1: Write the benchmarks** (run with `pnpm bench`; these compare, they don't assert)

`bench/quantile.bench.ts`:
```ts
import { bench, describe } from "vitest";
import { quantileSorted } from "d3-array";
import { quantile as ssQuantile } from "simple-statistics";
import { distribution, quantile } from "../src/index";

const N = 100_000;
const raw = Array.from({ length: N }, (_, i) => (i * 7919) % 1000);
const sorted = raw.slice().sort((a, b) => a - b);
const d = distribution(raw);

describe("quantile p50", () => {
  bench("distribu-tron (prepared)", () => { quantile(d, 0.5); });
  bench("distribu-tron (incl. prepare)", () => { quantile(distribution(raw), 0.5); });
  bench("d3-array quantileSorted", () => { quantileSorted(sorted, 0.5); });
  bench("simple-statistics quantile", () => { ssQuantile(raw, 0.5); });
});
```

`bench/histogram.bench.ts`:
```ts
import { bench, describe } from "vitest";
import { bin } from "d3-array";
import { distribution, histogram } from "../src/index";

const N = 100_000;
const raw = Array.from({ length: N }, (_, i) => Math.log1p((i * 7919) % 5000));
const d = distribution(raw);
const d3bin = bin();

describe("histogram", () => {
  bench("distribu-tron (prepared)", () => { histogram(d); });
  bench("d3-array bin", () => { d3bin(raw); });
});
```

- [ ] **Step 2: Run** `pnpm -C packages/distribu-tron bench`
Expected: a tinybench/vitest-bench table prints ops/sec for each. (No pass/fail; capture the numbers for the README.)

- [ ] **Step 3: Commit (if asked)** `git commit -m "bench: quantile + histogram vs d3-array/simple-statistics"`

---

## Task 21: README, LICENSE, publish & Pages pipeline

**Files:** Create `README.md`, `LICENSE`, `.github/workflows/release.yml`, `.github/workflows/pages.yml`

- [ ] **Step 1: LICENSE** — MIT, the user's name/year. (Standard MIT text; include the third-party ISC notice for d3 ticks/nice in a `NOTICE` section of the README.)

- [ ] **Step 2: README.md** — include: one-line positioning ("fast, weighted, plot-ready distribution statistics from a frequency table"); the gap/why (no maintained JS lib takes weighted frequency-table input); quick-start (`distribution()` + a couple of functions); the grouped/rollup example; an **ops/sec table** from Task 20; an API overview; the ISC attribution notice; roadmap bullets (phases 2–5 + adapters). Use the spec's examples verbatim where helpful.

- [ ] **Step 3: release.yml** (npm publish with provenance on a version tag)

```yaml
name: Release
on:
  push: { tags: ["v*"] }
permissions: { contents: read, id-token: write }
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, registry-url: "https://registry.npmjs.org", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C packages/distribu-tron build
      - run: pnpm -C packages/distribu-tron publish --no-git-checks --provenance --access public
        env: { NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}" }
```

- [ ] **Step 4: pages.yml** — RESERVED stub that builds `docs/` and deploys to GH Pages. Since `docs/` is not built in v1, commit a minimal placeholder workflow that is `workflow_dispatch`-only so it exists but never runs automatically:

```yaml
name: Docs (reserved)
on: { workflow_dispatch: {} }
jobs:
  noop:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Docs site not built yet — see roadmap."
```

- [ ] **Step 5: Pre-publish dry run**

Run: `pnpm -C packages/distribu-tron build && pnpm -C packages/distribu-tron pack`
Expected: a `.tgz` is produced; inspect its file list (`tar -tzf *.tgz`) to confirm it contains only `dist/`, `package.json`, `README.md`, `LICENSE`.

- [ ] **Step 6: Set version & publish** (user-driven)

Bump `packages/distribu-tron/package.json` to `0.1.0`, then the user creates a GitHub repo, pushes, sets the `NPM_TOKEN` secret, and tags `v0.1.0` to trigger `release.yml` — OR publishes manually with `pnpm -C packages/distribu-tron publish --provenance --access public`. (Publishing is the user's call; do not publish unprompted.)

- [ ] **Step 7: Commit (if asked)** `git commit -m "docs: README, LICENSE, release + pages workflows"`

---

## Final verification (after all tasks)

- [ ] `pnpm -C packages/distribu-tron test` — full suite green.
- [ ] `pnpm -C packages/distribu-tron typecheck` — no type errors.
- [ ] `pnpm -C packages/distribu-tron build` — emits `dist/index.js` (ESM) + `dist/index.d.ts`.
- [ ] `pnpm -C packages/distribu-tron pack` — tarball contains only `dist/` + metadata.
- [ ] `pnpm -C packages/distribu-tron bench` — prints comparison numbers (paste into README).