# Docs KDE Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the `apps/docs` site with the merged KDE-kernels library — drop the obsolete bandwidth overrides, add `kernel` + `smooth` props to `IoFigure`, add a kernel-comparison figure, and update the guide + reference content for the Gaussian default.

**Architecture:** Docs-only changes on `feat/docs-site` (main already merged in). `charts.ts` gains an opt-in `smooth` flag; `IoFigure` gains `kernel`/`smooth` props; a new `KernelComparison.vue` renders four output-only mini-KDEs on a shared grid; content pages are updated to the new API.

**Tech Stack:** VitePress 1.6 + Vue 3 `<script setup lang="ts">`, Vitest (for `charts.ts`), the merged `distribu-tron` library (Gaussian default, `KdeKernel` type, `scottBandwidth`).

**Spec:** [docs/designs/2026-06-10-docs-kde-reconciliation-design.md](../designs/2026-06-10-docs-kde-reconciliation-design.md)

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/docs/.vitepress/theme/charts.ts` | SVG geometry; `kdeCurve` gains a `smooth` param | Modify |
| `apps/docs/.vitepress/theme/charts.spec.ts` | Test straight (default) + smoothed branches | Modify |
| `apps/docs/.vitepress/theme/components/IoFigure.vue` | Add `kernel` + `smooth` props | Modify |
| `apps/docs/.vitepress/theme/components/KernelComparison.vue` | New four-kernel small-multiples figure | **Create** |
| `apps/docs/.vitepress/theme/index.js` | Register `KernelComparison` | Modify |
| `apps/docs/guide/shape-density.md` | New `kde` API text; drop override; comparison; migration note | Modify |
| `apps/docs/guide/descriptives.md` | Drop the `:bandwidth="15"` KDE override | Modify |
| `apps/docs/reference/histogram-kde-ecdf.md` | `kde` options (kernel/scott/SD); add `scottBandwidth` | Modify |
| `apps/docs/reference/index.md` | Add `scottBandwidth` + `KdeKernel` to the export map | Modify |

> **Commands:** the library must be built first so the docs import the merged API: `cd packages/distribu-tron && pnpm build`. Docs tests: `cd apps/docs && pnpm test`. Docs build (the integration gate): `cd apps/docs && pnpm build`. The shell resets to repo root between turns — use `cd <dir> && …` with absolute paths if it drifts.

> **Commits:** GPG signing is unavailable in the agent shell; if a `git commit` step fails to sign, stage the listed files and surface the commit command for the human to run, then continue. Do not bypass signing. (The `main`→`feat/docs-site` merge commit and the design-spec commit are already handled separately.)

> **Prerequisite:** run `cd packages/distribu-tron && pnpm build` once before Task 2 so the docs resolve the merged `distribu-tron` (with `KdeKernel`, `scottBandwidth`, gaussian default).

---

## Task 1: `charts.ts` — opt-in `smooth` on `kdeCurve`

**Files:**
- Modify: `apps/docs/.vitepress/theme/charts.ts`
- Modify: `apps/docs/.vitepress/theme/charts.spec.ts`

- [ ] **Step 1: Update the test for both branches**

In `apps/docs/.vitepress/theme/charts.spec.ts`, replace the `describe("kdeCurve", …)` block (the test that currently asserts the line `toContain(" Q ")`) with:

```ts
describe("kdeCurve", () => {
  const pts: KdePoint[] = [
    { x: 0, density: 0 },
    { x: 1, density: 1 },
    { x: 2, density: 0 },
  ];
  it("renders straight segments by default (real kde() polyline, no smoothing)", () => {
    const view = kdeCurve(pts, geo);
    expect(view.line.startsWith("M ")).toBe(true);
    expect(view.line).not.toContain(" Q ");
    expect(view.area.trim().endsWith("Z")).toBe(true);
    expect(view.peakY).toBeCloseTo(geo.padT, 5);
  });
  it("renders quadratic Béziers when smooth is true", () => {
    const view = kdeCurve(pts, geo, true);
    expect(view.line).toContain(" Q ");
    expect(view.area.trim().endsWith("Z")).toBe(true);
  });
  it("returns an empty view for no points", () => {
    expect(kdeCurve([], geo).line).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify the new default fails**

Run: `cd apps/docs && pnpm test`
Expected: FAIL — the "straight segments by default" test fails because `kdeCurve` currently always emits Béziers (`line` contains `" Q "`).

- [ ] **Step 3: Add the `smooth` parameter to `kdeCurve`**

In `apps/docs/.vitepress/theme/charts.ts`, replace the `kdeCurve` function (the signature line through its closing brace) with:

```ts
export function kdeCurve(
  points: KdePoint[],
  geo: ChartGeometry = DEFAULT_GEOMETRY,
  smooth = false,
): CurveView {
  const { iw, ih, baselineY } = inner(geo);
  if (points.length === 0) return { line: "", area: "", peakY: baselineY, baselineY };
  const lo = points[0].x;
  const hi = points[points.length - 1].x;
  const span = hi - lo || 1;
  const maxD = Math.max(...points.map((p) => p.density));
  const xy = points.map((p) => {
    const px = geo.padL + ((p.x - lo) / span) * iw;
    const py = geo.padT + ih - (maxD > 0 ? (p.density / maxD) * ih : 0);
    return [px, py] as const;
  });
  let line = `M ${xy[0][0]} ${xy[0][1]}`;
  if (smooth) {
    // Opt-in low-pass: quadratic Béziers through segment midpoints. Each Bézier stays within the
    // convex hull of its points, so the curve never overshoots above the peak or below the baseline.
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1];
      const [x1, y1] = xy[i];
      line += ` Q ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
    }
    line += ` L ${xy[xy.length - 1][0]} ${xy[xy.length - 1][1]}`;
  } else {
    // Default: straight segments tracing the real kde() values.
    for (let i = 1; i < xy.length; i++) line += ` L ${xy[i][0]} ${xy[i][1]}`;
  }
  const area = `${line} L ${xy[xy.length - 1][0]} ${baselineY} L ${xy[0][0]} ${baselineY} Z`;
  const peakY = geo.padT + ih - (maxD > 0 ? ih : 0);
  return { line, area, peakY, baselineY };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/docs && pnpm test`
Expected: PASS — straight-default, smooth-true, and empty cases all green (plus the existing histogram/ecdf tests).

- [ ] **Step 5: Commit**

```bash
git add apps/docs/.vitepress/theme/charts.ts apps/docs/.vitepress/theme/charts.spec.ts
git commit -m "feat(docs): make KDE Bézier smoothing opt-in (default straight)"
```

---

## Task 2: `IoFigure` — `kernel` + `smooth` props

**Files:**
- Modify: `apps/docs/.vitepress/theme/components/IoFigure.vue`

(Prerequisite: `cd packages/distribu-tron && pnpm build` so `KdeKernel` and the gaussian-default `kde` resolve.)

- [ ] **Step 1: Import `KdeKernel` and add the props**

In `apps/docs/.vitepress/theme/components/IoFigure.vue`, change the type import:

```ts
import type { DistributionInput } from "distribu-tron";
```

to:

```ts
import type { DistributionInput, KdeKernel } from "distribu-tron";
```

Then replace the `props` block:

```ts
const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    kind: "histogram" | "kde" | "ecdf";
    bins?: number;
    bandwidth?: number | "silverman";
    caption?: string;
  }>(),
  { caption: "" },
);
```

with:

```ts
const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    kind: "histogram" | "kde" | "ecdf";
    bins?: number;
    bandwidth?: number | "silverman" | "scott";
    kernel?: KdeKernel;
    smooth?: boolean;
    caption?: string;
  }>(),
  { caption: "", smooth: false },
);
```

- [ ] **Step 2: Forward `kernel` + `smooth` into the KDE computation**

Replace the `curve` computed:

```ts
const curve = computed(() =>
  props.kind === "kde"
    ? kdeCurve(kde(dist.value, props.bandwidth ? { bandwidth: props.bandwidth } : {}), geo)
    : null,
);
```

with:

```ts
const curve = computed(() =>
  props.kind === "kde"
    ? kdeCurve(
        kde(dist.value, {
          ...(props.bandwidth ? { bandwidth: props.bandwidth } : {}),
          ...(props.kernel ? { kernel: props.kernel } : {}),
        }),
        geo,
        props.smooth,
      )
    : null,
);
```

- [ ] **Step 3: Verify the build (SSR renders the component against the real library)**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors. (The existing figures still render — they just now use the gaussian default and straight rendering.)

- [ ] **Step 4: Commit**

```bash
git add apps/docs/.vitepress/theme/components/IoFigure.vue
git commit -m "feat(docs): add kernel and smooth props to IoFigure"
```

---

## Task 3: `KernelComparison.vue` + registration

**Files:**
- Create: `apps/docs/.vitepress/theme/components/KernelComparison.vue`
- Modify: `apps/docs/.vitepress/theme/index.js`

- [ ] **Step 1: Create the component**

Create `apps/docs/.vitepress/theme/components/KernelComparison.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { distribution, kde } from "distribu-tron";
import type { DistributionInput, KdeKernel } from "distribu-tron";
import { DEFAULT_GEOMETRY, kdeCurve } from "../charts";

const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    bandwidth?: number | "silverman" | "scott";
    caption?: string;
  }>(),
  { caption: "" },
);

const KERNELS: KdeKernel[] = ["gaussian", "epanechnikov", "triangular", "cosine"];
const geo = DEFAULT_GEOMETRY;
const dist = computed(() => distribution(props.input));
const hasData = computed(() => dist.value.n > 0);

// Shared x-grid so the four minis align: take the gaussian KDE's sample points and reuse them.
const grid = computed(() =>
  kde(dist.value, { kernel: "gaussian", ...(props.bandwidth ? { bandwidth: props.bandwidth } : {}) }).map(
    (p) => p.x,
  ),
);

const series = computed(() =>
  KERNELS.map((kernel) => {
    const pts = kde(dist.value, {
      kernel,
      samplePoints: grid.value,
      ...(props.bandwidth ? { bandwidth: props.bandwidth } : {}),
    });
    // Straight (smooth=false) so each kernel's real shape is visible in the comparison.
    return { kernel, view: kdeCurve(pts, geo, false) };
  }),
);
</script>

<template>
  <figure class="dt-kc">
    <figcaption class="dt-kc-cap">
      {{ caption || "kde() across kernels — same data and bandwidth" }}
    </figcaption>
    <div class="dt-kc-grid">
      <figure v-for="s in series" :key="s.kernel" class="dt-kc-cell">
        <svg class="dt-chart" :viewBox="`0 0 ${geo.width} ${geo.height}`" role="img"
             :aria-label="`${s.kernel} kernel density`">
          <template v-if="hasData">
            <path :d="s.view.area" fill="var(--dt-c2)" opacity="0.12" />
            <path :d="s.view.line" fill="none" stroke="var(--dt-c2)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="s.view.baselineY" :y2="s.view.baselineY" />
          </template>
        </svg>
        <figcaption class="dt-kc-label">{{ s.kernel }}</figcaption>
      </figure>
    </div>
  </figure>
</template>

<style scoped>
.dt-kc {
  margin: 26px 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  padding: 16px;
}
.dt-kc-cap {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  margin: 0 0 12px;
}
.dt-kc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.dt-kc-cell {
  margin: 0;
}
.dt-kc-label {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  text-align: center;
  margin-top: 4px;
}
@media (max-width: 720px) {
  .dt-kc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

> Note: the comparison is intentionally output-only — the dataset is already shown in the page's
> primary `<IoFigure>` immediately above it, so repeating the full input panel four times would be
> redundant. The caption conveys "same data and bandwidth."

- [ ] **Step 2: Register it in the theme**

In `apps/docs/.vitepress/theme/index.js`, replace the contents with:

```js
// .vitepress/theme/index.js
// distribu-tron "Neon Grid" theme — extends the VitePress default theme.
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import IoFigure from "./components/IoFigure.vue";
import KernelComparison from "./components/KernelComparison.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("IoFigure", IoFigure);
    app.component("KernelComparison", KernelComparison);
  },
};
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors. (`KernelComparison` is registered but not yet used on a page; it must still compile/SSR-resolve via the registration.)

- [ ] **Step 4: Commit**

```bash
git add apps/docs/.vitepress/theme/components/KernelComparison.vue apps/docs/.vitepress/theme/index.js
git commit -m "feat(docs): add KernelComparison small-multiples component"
```

---

## Task 4: Guide content — shape-density + descriptives

**Files:**
- Modify: `apps/docs/guide/shape-density.md`
- Modify: `apps/docs/guide/descriptives.md`

- [ ] **Step 1: Drop the bandwidth override on the shape-density KDE figure**

In `apps/docs/guide/shape-density.md`, the KDE `<IoFigure>` line currently reads (one long line):

```md
<IoFigure :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" kind="kde" :bandwidth="15" caption="kde() · bandwidth 15" />
```

Replace it with (drop `:bandwidth="15"`, update caption):

```md
<IoFigure :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" kind="kde" caption="kde() — gaussian default" />
```

- [ ] **Step 2: Rewrite the `kde` section text**

In `apps/docs/guide/shape-density.md`, replace the entire `## \`kde\`` section (from the `## \`kde\`` heading through the paragraph ending "...the spread (and thus the Silverman bandwidth) is `0`.") with:

````md
## `kde`

```ts
import { distribution, kde, silvermanBandwidth, scottBandwidth } from "distribu-tron";

kde(d);                                  // gaussian kernel + silverman bandwidth (defaults)
kde(d, { kernel: "epanechnikov" });      // pick a kernel
kde(d, { bandwidth: 2.5 });              // numeric bandwidth = kernel standard deviation
kde(d, { bandwidth: "scott" });          // Scott's rule (alternative selector)
kde(d, { resolution: 80 });              // number of sample points across the domain
```

`kde` returns a `KdePoint[]`, each `{ x, density }`. Options (`KdeOptions`):

- **`kernel: "gaussian" | "epanechnikov" | "triangular" | "cosine"`** — the smoothing kernel,
  default `"gaussian"` (smooth and continuously differentiable).
- **`bandwidth: number | "silverman" | "scott"`** — the **kernel standard deviation**; a numeric
  value gives comparable smoothing across every kernel. `"silverman"` (default, robust) and
  `"scott"` (normal-reference) are data-driven selectors.
- **`resolution`** (default `50`) — the number of evenly spaced sample points across the domain.

> **The default just works.** With the gaussian kernel and Silverman bandwidth, `kde(d)` returns a
> smooth curve out of the box — no kernel or bandwidth tuning needed for a clean plot.

KDE returns `[]` when the resolved bandwidth is not positive — which includes the degenerate
single-value case, where the spread (and thus the bandwidth) is `0`.

The four kernels differ mostly at the tails and in smoothness — same data, same bandwidth:

<KernelComparison :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]" />

> **Changed in the kernel update.** The default kernel is now **gaussian** (was Epanechnikov), and a
> numeric `bandwidth` now means the kernel **standard deviation**, not the Epanechnikov half-width.
> To reproduce an old curve, pass `{ kernel: "epanechnikov" }` and `bandwidth: h / Math.sqrt(5)`.
````

- [ ] **Step 3: Drop the bandwidth override on the descriptives KDE figure**

In `apps/docs/guide/descriptives.md`, find the KDE `<IoFigure>` (multi-line) which includes a `:bandwidth="15"` attribute line:

```md
<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="kde"
  :bandwidth="15"
  caption="kde() of the exam-score table" />
```

Remove the `  :bandwidth="15"` line so it reads:

```md
<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="kde"
  caption="kde() of the exam-score table" />
```

- [ ] **Step 4: Verify the build (renders the new figures + comparison)**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors, no dead links. The KernelComparison SSR-renders four kernels.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/guide/shape-density.md apps/docs/guide/descriptives.md
git commit -m "docs(docs): update KDE guide for gaussian default + kernel comparison"
```

---

## Task 5: Reference content — kde options + scottBandwidth

**Files:**
- Modify: `apps/docs/reference/histogram-kde-ecdf.md`
- Modify: `apps/docs/reference/index.md`

- [ ] **Step 1: Update the import line and `kde` heading**

In `apps/docs/reference/histogram-kde-ecdf.md`:

Replace the import:

```ts
import { histogram, DEFAULT_MAX_AUTO_BINS, kde, silvermanBandwidth, ecdf, cdf } from "distribu-tron";
```

with:

```ts
import { histogram, DEFAULT_MAX_AUTO_BINS, kde, silvermanBandwidth, scottBandwidth, ecdf, cdf } from "distribu-tron";
```

Replace the `kde` description line:

```md
Windowed Epanechnikov kernel density estimate over the prepared distribution. Returns `KdePoint[]`.
```

with:

```md
Windowed kernel density estimate over the prepared distribution. The kernel defaults to **gaussian**.
Returns `KdePoint[]`.
```

- [ ] **Step 2: Replace the `KdeOptions` block and its bullets**

In `apps/docs/reference/histogram-kde-ecdf.md`, replace the `KdeOptions` interface code block:

```ts
interface KdeOptions {
  bandwidth?: number | "silverman"; // numeric width, or "silverman" (the default)
  resolution?: number; // number of interior sample points (default 50)
  clamp?: boolean; // restrict the grid to [d.min, d.max] (default false)
  samplePoints?: ArrayLike<number>; // explicit x grid; overrides resolution/clamp entirely
  kernel?: "epanechnikov"; // only "epanechnikov" is supported (the default)
}
```

with:

```ts
type KdeKernel = "gaussian" | "epanechnikov" | "triangular" | "cosine";

interface KdeOptions {
  bandwidth?: number | "silverman" | "scott"; // kernel standard deviation; "silverman" is the default
  resolution?: number; // number of interior sample points (default 50)
  clamp?: boolean; // restrict the grid to [d.min, d.max] (default false)
  samplePoints?: ArrayLike<number>; // explicit x grid; overrides resolution/clamp entirely
  kernel?: KdeKernel; // smoothing kernel; "gaussian" is the default
}
```

Then replace the `bandwidth` and `kernel` bullets (currently the first bullet about `bandwidth` and the last bullet about `kernel`) so the bullet list reads:

```md
- **`bandwidth`** — the **kernel standard deviation**. A positive number passes through (the same
  value gives comparable smoothing across kernels); `"silverman"` (the default, robust) derives the
  bandwidth via [`silvermanBandwidth`](#silvermanbandwidth-n-iqr-sd), and `"scott"` via
  [`scottBandwidth`](#scottbandwidth-n-sd) (normal-reference). Both are standard-deviation-scale.
- **`resolution`** (default `50`) — the number of interior sample points; the grid is padded with
  tapering buffer points on each side unless `clamp` is set.
- **`clamp`** (default `false`) — when `true`, anchors the grid to exactly `[d.min, d.max]` and
  drops points outside it (no tapering tails). When `false`, the result is trimmed of leading/trailing
  all-zero tails.
- **`samplePoints`** — an explicit x grid. When provided it is used exactly as given (no padding,
  trimming, or clamping); `resolution` and `clamp` are ignored.
- **`kernel`** — `"gaussian" | "epanechnikov" | "triangular" | "cosine"`, default `"gaussian"`. The
  `KdeKernel` type is exported. Gaussian is smooth; the compact kernels (epanechnikov, triangular,
  cosine) have finite support.
```

- [ ] **Step 3: Add the `scottBandwidth` reference section**

In `apps/docs/reference/histogram-kde-ecdf.md`, immediately AFTER the `silvermanBandwidth` section (after its `::: tip ... :::` block, before `## \`ecdf(d)\``), insert:

````md
## `scottBandwidth(n, sd)`

Scott's normal-reference bandwidth: `1.06 · sd · n^(−1/5)`. Like Silverman but without the robust
`min(·, IQR/1.349)` term, so it uses the full standard deviation. Returns `number` (standard-deviation
scale, matching the `bandwidth` convention).

**Parameters**

- `n: number` — effective sample size (total weight).
- `sd: number` — the standard deviation.

**Returns** `number` — the bandwidth.

**Degenerate input** — `0` when `sd` is `0`; `Infinity` when `n ≤ 0` (and `sd > 0`). `kde()` treats
any non-positive bandwidth as degenerate and returns `[]`.
````

- [ ] **Step 4: Add `scottBandwidth` + `KdeKernel` to the reference overview export map**

In `apps/docs/reference/index.md`, in the "Histogram, KDE, ECDF" list, add a `scottBandwidth` entry directly after the `silvermanBandwidth` line. Find:

```md
- [`silvermanBandwidth(n, iqr, sd)`](./histogram-kde-ecdf#silvermanbandwidth-n-iqr-sd)
- [`ecdf(d)`](./histogram-kde-ecdf#ecdf-d)
```

Replace with:

```md
- [`silvermanBandwidth(n, iqr, sd)`](./histogram-kde-ecdf#silvermanbandwidth-n-iqr-sd)
- [`scottBandwidth(n, sd)`](./histogram-kde-ecdf#scottbandwidth-n-sd)
- [`ecdf(d)`](./histogram-kde-ecdf#ecdf-d)
```

Then add `KdeKernel` to the Types paragraph. Find:

```md
`HistogramOptions`, `KdeOptions`, `GroupKeyValue`, `Accessor`, `GroupSpec`, `DistributionGroup`,
```

Replace with:

```md
`HistogramOptions`, `KdeOptions`, `KdeKernel`, `GroupKeyValue`, `Accessor`, `GroupSpec`, `DistributionGroup`,
```

- [ ] **Step 5: Verify the build (no dead links — the new `#scottbandwidth-n-sd` anchors must resolve)**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors, NO dead-link warnings (VitePress validates the in-page and cross-page anchors, including the new `scottBandwidth` links).

- [ ] **Step 6: Commit**

```bash
git add apps/docs/reference/histogram-kde-ecdf.md apps/docs/reference/index.md
git commit -m "docs(docs): reference kde kernels + scottBandwidth"
```

---

## Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Build the library, then the docs, from clean**

Run:

```bash
cd packages/distribu-tron && pnpm build
cd c:/Repos/distribu-tron/apps/docs && pnpm test
cd c:/Repos/distribu-tron/apps/docs && pnpm build
```

Expected: library builds; `charts.spec.ts` passes (straight default + smooth branch); docs build completes with **no dead links** and SSR-renders every figure (the now-default KDE figures and the `KernelComparison`) against the merged library.

- [ ] **Step 2: Visual acceptance pass (human)**

Run: `cd c:/Repos/distribu-tron/apps/docs && pnpm dev` and open the site. Verify in light + dark:
- shape-density and descriptives KDE figures: smooth gaussian curve, no `bandwidth 15` caption.
- The kernel comparison: gaussian/cosine smooth, triangular visibly bumpier, epanechnikov in between — i.e. the kernels are *distinguishable* (confirming `smooth` is off).
- If a specific figure looks too angular as straight segments, set `smooth` on that one `<IoFigure>` (the prop exists) — but the gaussian default at resolution 50 should look clean.

Stop the dev server when done.

- [ ] **Step 3: Confirm no stray library edits**

Run: `git status --short` and confirm only `apps/docs/**` files changed in this plan's commits (the library lives on `main`; this branch is docs-only). The merged `packages/**` files belong to the earlier merge commit, not these.

---

## Notes for the executor

- **Build the library before the docs.** The docs import the merged `distribu-tron` (gaussian default, `KdeKernel`, `scottBandwidth`). If you see `KdeKernel` unresolved or a missing `scottBandwidth`, run `cd packages/distribu-tron && pnpm build`.
- **`smooth` defaults to `false`** everywhere — figures render the real `kde()` polyline. The Bézier path is opt-in (`smooth` prop / `kdeCurve(..., true)`). The `KernelComparison` always renders straight so kernel differences stay visible.
- **`bandwidth` is the kernel standard deviation** now; don't reintroduce the `bandwidth: 15` workaround — the gaussian default is smooth on its own.
- **Don't edit the vendored theme** (`custom.css`, favicons, logos, `vitepress-preview.html`).
- **Don't touch `packages/**`** — the library work is merged on `main`; this branch is docs-only.
```
