# VitePress Docs Site (`apps/docs`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a buildable, GitHub-Pages-deployed VitePress documentation site for `distribu-tron`, using the pre-landed "Neon Grid" theme, with a real data-driven chart component and fully authored Guide + Reference content.

**Architecture:** A new private `apps/docs` pnpm workspace package holds a VitePress site that depends on the built `distribu-tron` package (`workspace:*`). A single `IoFigure` Vue component computes figures from the real library output via pure geometry helpers in `charts.ts`, so docs figures can't drift from the API. Infrastructure (Tasks 1–3) lands first to prove the pipeline, then content (Tasks 4–6), then full nav/IA (Task 7), then deploy (Tasks 8–9).

**Tech Stack:** VitePress 1.6.x, Vue 3.5.x, pnpm 11.5.2 workspaces, Node ≥22, GitHub Actions + Pages. No external charting library (inline SVG).

**Spec:** [docs/designs/2026-06-09-docs-site-scaffold-design.md](../designs/2026-06-09-docs-site-scaffold-design.md)

---

## File Structure

Created under `apps/docs/`:

| File | Responsibility |
| --- | --- |
| `package.json` | Private workspace package; vitepress scripts; `distribu-tron` workspace dep. |
| `.vitepress/config.ts` | Site config: IA (nav/sidebar), base path, theme/shiki, fonts/favicons, `noindex`. |
| `.vitepress/theme/index.js` | (exists) Extends default theme; **modified** to register `IoFigure`. |
| `.vitepress/theme/custom.css` | (exists, vendored) Neon Grid tokens + `.dt-io` classes. Not edited. |
| `.vitepress/theme/charts.ts` | Pure geometry helpers: `Bin[]`/`KdePoint[]`/`EcdfPoint[]` → SVG primitives. |
| `.vitepress/theme/charts.spec.ts` | Unit tests for `charts.ts` (no DOM, no lib runtime). |
| `.vitepress/theme/components/IoFigure.vue` | The signature component; imports the library + `charts.ts`. |
| `index.md` | Home page (hero). |
| `guide/*.md` | Guide content (9 pages). |
| `reference/*.md` | Hand-written API reference (7 pages). |
| `roadmap.md` | Roadmap, distilled from the roadmap design doc. |
| (existing) `public/logo.svg`, `public/logo-bars.svg`, `public/favicons/*` | Vendored assets. |
| (existing) `.vitepress/theme/vitepress-preview.html` | Vendored visual acceptance target. Not served. |

Repo root:

| File | Responsibility |
| --- | --- |
| `pnpm-workspace.yaml` | **Modified** — add `apps/*`. |
| `package.json` | **Modified** — add `docs:dev` / `docs:build` delegating scripts. |
| `.github/workflows/docs.yml` | **Created** — build lib → build docs → deploy to Pages. |
| `README.md` | **Modified** (Task 9) — add live docs URL. |

> **Working directory note:** the shell resets to repo root between turns. Prefix package commands with `-C` (e.g. `pnpm -C apps/docs build`) or `cd` first. `pnpm -C` occasionally fails in this environment — fall back to `cd apps/docs && pnpm …`.

---

## Task 1: Workspace wiring + minimal buildable site

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `apps/docs/package.json`
- Create: `apps/docs/.vitepress/config.ts`
- Create: `apps/docs/index.md`
- Modify: `package.json` (root)

- [ ] **Step 1: Add `apps/*` to the workspace**

Edit `pnpm-workspace.yaml` so the `packages` list reads:

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "docs"
  - "playground"
allowBuilds:
  esbuild: true
```

- [ ] **Step 2: Create the docs package manifest**

Create `apps/docs/package.json`:

```json
{
  "name": "@distribu-tron/docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview",
    "test": "vitest run"
  },
  "dependencies": {
    "distribu-tron": "workspace:*"
  },
  "devDependencies": {
    "vitepress": "^1.6.3",
    "vue": "^3.5.13",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: Create a minimal VitePress config**

Create `apps/docs/.vitepress/config.ts`. This is the *minimal* config that builds; the full nav/sidebar lands in Task 7. The `base` and `head` asset prefixing are correct from the start so assets never 404 on Pages.

```ts
import { defineConfig } from "vitepress";

// GitHub Pages project site → served under /distribu-tron/.
const base = "/distribu-tron/";

export default defineConfig({
  base,
  lang: "en-US",
  title: "distribu-tron",
  description: "Weighted, plot-ready distribution statistics from a frequency table.",
  appearance: true,
  cleanUrls: true,
  head: [
    // TEMP: keep the site out of search indexes while building/testing.
    // Remove this line before the public launch.
    ["meta", { name: "robots", content: "noindex, nofollow" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=Orbitron:wght@600;700;900&display=swap",
      },
    ],
    // base-prefixed by hand: VitePress does NOT rewrite raw head hrefs for `base`.
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}logo.svg` }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: `${base}favicons/favicon-32.png` }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: `${base}favicons/apple-touch-icon.png` }],
  ],
  markdown: {
    theme: { light: "github-light", dark: "material-theme-palenight" },
  },
  themeConfig: {
    logo: "/logo.svg", // VitePress prefixes `base` for themeConfig assets automatically.
    siteTitle: "distribu-tron",
    socialLinks: [{ icon: "github", link: "https://github.com/dm-p/distribu-tron" }],
  },
});
```

- [ ] **Step 4: Create a minimal home page**

Create `apps/docs/index.md`:

```markdown
---
layout: home
hero:
  name: distribu-tron
  text: Weighted distribution statistics
  tagline: Quantiles, descriptives, histogram, KDE, ECDF and grouped ROLLUP variants — computed straight from a frequency table.
  actions:
    - theme: brand
      text: What is it?
      link: /guide/what-is-it
    - theme: alt
      text: GitHub
      link: https://github.com/dm-p/distribu-tron
---
```

> The `link: /guide/what-is-it` target does not exist yet. To keep this task's build green, **comment out the `actions:` block** for now (or point both actions at `https://github.com/dm-p/distribu-tron`). Task 7 restores the real internal links once the guide pages exist. Pick one and note it.

- [ ] **Step 5: Add root delegating scripts**

In root `package.json`, add to `scripts`:

```json
    "docs:dev": "pnpm -C apps/docs dev",
    "docs:build": "pnpm -C apps/docs build"
```

- [ ] **Step 6: Install and build**

Run:

```bash
pnpm install
cd apps/docs && pnpm build
```

Expected: install adds vitepress/vue/vitest to `apps/docs`; `pnpm build` prints "build complete" and produces `apps/docs/.vitepress/dist/`. No dead-link errors (the home page has none once Step 4's note is applied).

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml apps/docs/package.json apps/docs/.vitepress/config.ts apps/docs/index.md
git commit -m "feat(docs): scaffold apps/docs VitePress workspace package"
```

---

## Task 2: `charts.ts` geometry helpers (pure, TDD)

These are pure functions: library output arrays → SVG primitive data. No DOM, no library *runtime* import (type-only import is erased), so they unit-test in isolation. Geometry constants match the vendored `vitepress-preview.html` so the output matches the visual target.

**Files:**
- Create: `apps/docs/.vitepress/theme/charts.ts`
- Test: `apps/docs/.vitepress/theme/charts.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/docs/.vitepress/theme/charts.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Bin, EcdfPoint, KdePoint } from "distribu-tron";
import { DEFAULT_GEOMETRY, ecdfStep, histogramBars, kdeCurve } from "./charts";

const geo = DEFAULT_GEOMETRY;

describe("histogramBars", () => {
  it("emits one rect per bin, alternating series, tallest bar at the max weight", () => {
    const bins: Bin[] = [
      { x0: 0, x1: 1, weight: 2 },
      { x0: 1, x1: 2, weight: 4 },
      { x0: 2, x1: 3, weight: 1 },
    ];
    const view = histogramBars(bins, geo);
    expect(view.rects).toHaveLength(3);
    expect(view.rects[0].series).toBe(1);
    expect(view.rects[1].series).toBe(2);
    // weight 4 is the max → full inner height; weight 2 → half of it.
    const ih = geo.height - geo.padT - geo.padB;
    expect(view.rects[1].height).toBeCloseTo(ih, 5);
    expect(view.rects[0].height).toBeCloseTo(ih / 2, 5);
    // bars sit on the baseline (padT + ih).
    expect(view.rects[1].y).toBeCloseTo(geo.padT, 5);
    expect(view.gridlines).toHaveLength(4); // 0..3
  });

  it("returns an empty view for no bins", () => {
    expect(histogramBars([], geo).rects).toHaveLength(0);
  });
});

describe("kdeCurve", () => {
  it("produces a line path and a closed area path ending on the baseline", () => {
    const pts: KdePoint[] = [
      { x: 0, density: 0 },
      { x: 1, density: 1 },
      { x: 2, density: 0 },
    ];
    const view = kdeCurve(pts, geo);
    expect(view.line.startsWith("M ")).toBe(true);
    expect(view.area.trim().endsWith("Z")).toBe(true);
    // peak density maps to the top of the chart area.
    expect(view.peakY).toBeCloseTo(geo.padT, 5);
  });

  it("returns an empty view for no points", () => {
    expect(kdeCurve([], geo).line).toBe("");
  });
});

describe("ecdfStep", () => {
  it("produces a monotonic step path from p=0 to p=1", () => {
    const pts: EcdfPoint[] = [
      { x: 0, p: 0.25 },
      { x: 1, p: 0.75 },
      { x: 2, p: 1 },
    ];
    const view = ecdfStep(pts, geo);
    expect(view.line.startsWith("M ")).toBe(true);
    // p=1 maps to the top, p=0 to the baseline.
    const ih = geo.height - geo.padT - geo.padB;
    expect(view.topY).toBeCloseTo(geo.padT, 5);
    expect(view.baselineY).toBeCloseTo(geo.padT + ih, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/docs && pnpm test`
Expected: FAIL — `Cannot find module "./charts"` (or "histogramBars is not a function").

- [ ] **Step 3: Implement `charts.ts`**

Create `apps/docs/.vitepress/theme/charts.ts`:

```ts
// Pure geometry: turn distribu-tron's plot-ready arrays into SVG primitive data.
// No DOM and no runtime library dependency (the import below is type-only and is
// erased at build time), so these functions are unit-testable in isolation.
import type { Bin, EcdfPoint, KdePoint } from "distribu-tron";

export interface ChartGeometry {
  width: number;
  height: number;
  padL: number; // left pad (y labels)
  padT: number; // top pad
  padB: number; // bottom pad (x labels)
  padR: number; // right pad
}

// Matches vitepress-preview.html (W=320,H=170,PX=30,PY=14,PB=22, right inset 8).
export const DEFAULT_GEOMETRY: ChartGeometry = {
  width: 320,
  height: 170,
  padL: 30,
  padT: 14,
  padB: 22,
  padR: 8,
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  series: 1 | 2;
}
export interface Gridline {
  y: number;
  label: string;
}
export interface AxisTick {
  x: number;
  label: string;
}
export interface BarsView {
  rects: Rect[];
  gridlines: Gridline[];
  xTicks: AxisTick[];
}
export interface CurveView {
  line: string;
  area: string;
  peakY: number;
  baselineY: number;
}
export interface StepView {
  line: string;
  topY: number;
  baselineY: number;
}

function inner(geo: ChartGeometry) {
  return {
    iw: geo.width - geo.padL - geo.padR,
    ih: geo.height - geo.padT - geo.padB,
    baselineY: geo.padT + (geo.height - geo.padT - geo.padB),
  };
}

function round(n: number): string {
  return String(Math.round(n));
}

export function histogramBars(bins: Bin[], geo: ChartGeometry = DEFAULT_GEOMETRY): BarsView {
  if (bins.length === 0) return { rects: [], gridlines: [], xTicks: [] };
  const { iw, ih } = inner(geo);
  const maxWeight = Math.max(...bins.map((b) => b.weight));
  const n = bins.length;
  const gap = 4;
  const bw = (iw - gap * (n - 1)) / n;

  const rects: Rect[] = bins.map((b, i) => {
    const h = maxWeight > 0 ? (ih * b.weight) / maxWeight : 0;
    return {
      x: geo.padL + i * (bw + gap),
      y: geo.padT + ih - h,
      width: bw,
      height: h,
      series: (i % 2 === 0 ? 1 : 2) as 1 | 2,
    };
  });

  const gridlines: Gridline[] = [];
  for (let g = 0; g <= 3; g++) {
    gridlines.push({ y: geo.padT + ih - (ih * g) / 3, label: round((maxWeight * g) / 3) });
  }

  // Three value-domain ticks across [first x0, last x1].
  const lo = bins[0].x0;
  const hi = bins[n - 1].x1;
  const xTicks: AxisTick[] = [0, 0.5, 1].map((t) => ({
    x: geo.padL + t * iw,
    label: round(lo + t * (hi - lo)),
  }));

  return { rects, gridlines, xTicks };
}

export function kdeCurve(points: KdePoint[], geo: ChartGeometry = DEFAULT_GEOMETRY): CurveView {
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
  const line = `M ${xy[0][0]} ${xy[0][1]}` + xy.slice(1).map(([x, y]) => ` L ${x} ${y}`).join("");
  const area = `${line} L ${xy[xy.length - 1][0]} ${baselineY} L ${xy[0][0]} ${baselineY} Z`;
  const peakY = geo.padT + ih - (maxD > 0 ? ih : 0);
  return { line, area, peakY, baselineY };
}

export function ecdfStep(points: EcdfPoint[], geo: ChartGeometry = DEFAULT_GEOMETRY): StepView {
  const { iw, ih, baselineY } = inner(geo);
  const topY = geo.padT;
  if (points.length === 0) return { line: "", topY, baselineY };
  const lo = points[0].x;
  const hi = points[points.length - 1].x;
  const span = hi - lo || 1;
  const py = (p: number) => geo.padT + ih - p * ih;
  const px = (x: number) => geo.padL + ((x - lo) / span) * iw;
  // step-after: horizontal to the next x, then vertical to its p.
  let d = `M ${px(points[0].x)} ${py(points[0].p)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${px(points[i].x)} V ${py(points[i].p)}`;
  }
  return { line: d, topY, baselineY };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/docs && pnpm test`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/.vitepress/theme/charts.ts apps/docs/.vitepress/theme/charts.spec.ts
git commit -m "feat(docs): add pure SVG geometry helpers for IoFigure"
```

---

## Task 3: `IoFigure` component + theme registration

**Files:**
- Create: `apps/docs/.vitepress/theme/components/IoFigure.vue`
- Modify: `apps/docs/.vitepress/theme/index.js`
- Modify: `apps/docs/index.md` (temporarily, to smoke-test the component)

- [ ] **Step 1: Build the library so the docs can import it**

Run: `cd packages/distribu-tron && pnpm build`
Expected: produces `packages/distribu-tron/dist/index.js` + `dist/index.d.ts`. (The docs import the package's `exports`, which point at `dist`.)

- [ ] **Step 2: Create the `IoFigure` component**

Create `apps/docs/.vitepress/theme/components/IoFigure.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { distribution, ecdf, histogram, kde } from "distribu-tron";
import type { DistributionInput } from "distribu-tron";
import { DEFAULT_GEOMETRY, ecdfStep, histogramBars, kdeCurve } from "../charts";

const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    kind: "histogram" | "kde" | "ecdf";
    bins?: number;
    caption?: string;
  }>(),
  { caption: "" },
);

const geo = DEFAULT_GEOMETRY;
const dist = computed(() => distribution(props.input));
const hasData = computed(() => dist.value.n > 0);

const bars = computed(() =>
  props.kind === "histogram"
    ? histogramBars(histogram(dist.value, props.bins ? { binCount: props.bins } : {}), geo)
    : null,
);
const curve = computed(() => (props.kind === "kde" ? kdeCurve(kde(dist.value), geo) : null));
const step = computed(() => (props.kind === "ecdf" ? ecdfStep(ecdf(dist.value), geo) : null));

const inputText = computed(() => JSON.stringify(props.input, null, 0));
const outLabel = computed(() =>
  props.kind === "histogram"
    ? `${bars.value?.rects.length ?? 0} bins · weights conserved`
    : props.kind === "kde"
      ? "kernel density"
      : "ECDF",
);
</script>

<template>
  <figure class="dt-io">
    <div class="dt-io-in">
      <div class="dt-io-head"><span class="dot" style="background:#ff5fcf"></span>input</div>
      <pre><code>{{ inputText }}</code></pre>
    </div>
    <figure class="dt-io-out">
      <div class="dt-io-head"><span class="dot" style="background:#5fe9ff"></span>output</div>
      <svg class="dt-chart" :viewBox="`0 0 ${geo.width} ${geo.height}`" role="img"
           :aria-label="`${kind} of the input distribution`">
        <template v-if="hasData">
          <!-- histogram -->
          <template v-if="kind === 'histogram' && bars">
            <line v-for="(g, i) in bars.gridlines" :key="`g${i}`" class="axis"
                  :x1="geo.padL" :x2="geo.width - geo.padR" :y1="g.y" :y2="g.y" />
            <text v-for="(g, i) in bars.gridlines" :key="`gl${i}`" :x="geo.padL - 6" :y="g.y + 3"
                  text-anchor="end">{{ g.label }}</text>
            <rect v-for="(r, i) in bars.rects" :key="`r${i}`" :x="r.x" :y="r.y" :width="r.width"
                  :height="r.height" rx="1.5" opacity="0.92"
                  :fill="r.series === 1 ? 'var(--dt-c1)' : 'var(--dt-c2)'" />
            <text v-for="(t, i) in bars.xTicks" :key="`x${i}`" :x="t.x" :y="geo.height - 6"
                  text-anchor="middle">{{ t.label }}</text>
          </template>
          <!-- kde -->
          <template v-else-if="kind === 'kde' && curve">
            <path :d="curve.area" fill="var(--dt-c2)" opacity="0.12" />
            <path :d="curve.line" fill="none" stroke="var(--dt-c2)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="curve.baselineY" :y2="curve.baselineY" />
          </template>
          <!-- ecdf -->
          <template v-else-if="kind === 'ecdf' && step">
            <path :d="step.line" fill="none" stroke="var(--dt-c1)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="step.baselineY" :y2="step.baselineY" />
          </template>
        </template>
        <text v-else :x="geo.width / 2" :y="geo.height / 2" text-anchor="middle">no data</text>
      </svg>
      <figcaption>{{ caption || outLabel }}</figcaption>
    </figure>
  </figure>
</template>
```

- [ ] **Step 3: Register the component in the theme**

Replace the contents of `apps/docs/.vitepress/theme/index.js` with:

```js
// .vitepress/theme/index.js
// distribu-tron "Neon Grid" theme — extends the VitePress default theme.
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import IoFigure from "./components/IoFigure.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("IoFigure", IoFigure);
  },
};
```

- [ ] **Step 4: Smoke-test the component on the home page**

Append to `apps/docs/index.md` (temporarily — removed in Task 6):

```markdown

<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="histogram" />
```

- [ ] **Step 5: Verify dev render**

Run: `cd apps/docs && pnpm dev`
Open `http://localhost:5173/distribu-tron/`. Expected: the histogram renders with alternating cyan/magenta bars, gridlines, and x-axis value labels (0…40). Toggle dark/light — bar colors recolor via `--dt-c1/--dt-c2`. Stop the dev server.

- [ ] **Step 6: Verify production build**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors. (A library API break would fail this step — that's the intended integration check.)

- [ ] **Step 7: Commit**

```bash
git add apps/docs/.vitepress/theme/components/IoFigure.vue apps/docs/.vitepress/theme/index.js apps/docs/index.md
git commit -m "feat(docs): add IoFigure component rendering real library output"
```

---

## Task 4: Guide content pages

Author nine Guide pages as markdown. Draw prose from the root `README.md` and the source modules; embed at least one real `<IoFigure>` per conceptual page. Keep voice concise and technical, matching the README.

**Reusable example dataset** (an exam-score frequency table) — use this literal across pages for continuity:

```
[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]
```

**Files (create all):**
- `apps/docs/guide/what-is-it.md`
- `apps/docs/guide/getting-started.md`
- `apps/docs/guide/the-model.md`
- `apps/docs/guide/descriptives.md`
- `apps/docs/guide/quantiles.md`
- `apps/docs/guide/shape-density.md`
- `apps/docs/guide/grouping.md`
- `apps/docs/guide/summarize.md`
- `apps/docs/guide/grouped-plots.md`

- [ ] **Step 1: Author `what-is-it.md`** — sections: "What is distribu-tron?" (the one-paragraph pitch from README intro), "When to use it / when not to" (adapt README's "Performance — and when not to use this"), "Feature tour" (bulleted list of the public surface). No figure required.

- [ ] **Step 2: Author `getting-started.md`** — full exemplar below; use it verbatim as the quality bar for the other pages:

````markdown
# Getting started

`distribu-tron` is a zero-dependency, ESM-only library. Install it from npm:

```bash
npm i distribu-tron
```

It works on **already-aggregated** data — a frequency table of `{ value, weight }` — rather than a
raw sample array. Build a `Distribution` once, then read many statistics off it.

```ts
import { distribution, mean, median, histogram } from "distribu-tron";

const scores = distribution([
  { value: 0, weight: 8 },
  { value: 4, weight: 19 },
  { value: 8, weight: 34 },
  // …
]);

mean(scores);   // weighted mean
median(scores); // weighted median
histogram(scores); // → Bin[] ready to plot
```

Every reader function takes a `Distribution` and never re-sorts or re-aggregates. The histogram
below is computed from the table above — no raw samples involved:

<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="histogram"
  caption="11 bins · weights conserved" />
````

- [ ] **Step 3: Author `the-model.md`** — explain the prepared-substrate model (from CLAUDE.md / README): `distribution()` normalizes input into a sorted, distinct `Float64Array` substrate (`values`, `weights`, `cumulative`) plus `size`, `n` (= Σ weight), `min`, `max`; free functions read it via binary search / scans. Note `n` is total weight, not row count, and the `{ sorted: true }` fast path. No figure required.

- [ ] **Step 4: Author `descriptives.md`** — cover `mean, stdev, variance, min, max, range, mode, mad, skewness, kurtosis`. One short example per group. Mention Neumaier-stable summation. Embed one `<IoFigure ... kind="kde" />` of the example dataset to visualize shape alongside the numbers.

- [ ] **Step 5: Author `quantiles.md`** — cover `quantile` (with the 5 `QuantileMethod`s), `median`, `quartiles`, `percentileRank`, and `boxplot` (whiskers, fences, `lowerAdjacent`/`upperAdjacent`, outliers). Show the `BoxplotResult` shape. No `IoFigure` (box plot is not one of the three kinds); render the box stats as a table.

- [ ] **Step 6: Author `shape-density.md`** — the figure-heavy page. Cover `histogram` (FD rule, `binCount`/`maxBins`/`edges`, `DEFAULT_MAX_AUTO_BINS`), `kde` (`bandwidth: 'silverman' | number`, `resolution`, Epanechnikov kernel, `silvermanBandwidth`), and `ecdf`/`cdf`. Embed all three figures on the same dataset:

```markdown
<IoFigure :input="DATASET" kind="histogram" caption="histogram()" />
<IoFigure :input="DATASET" kind="kde" caption="kde()" />
<IoFigure :input="DATASET" kind="ecdf" caption="ecdf()" />
```

(Replace `DATASET` with the reusable literal above in each tag.)

- [ ] **Step 7: Author `grouping.md`** — cover `group(rows, spec)`: `by`, `value`/`weight` accessors, `rollup`, `totalLabel`, the `GroupedDistribution` / `DistributionGroup` shape (`key`, `level`, `depth`, `distribution`), and the ROLLUP subtotal + grand-total tagging. Note the guard that throws when a grouping dimension collides with an output field name. No figure required.

- [ ] **Step 8: Author `summarize.md`** — cover `summarize` over a `GroupedDistribution`, the `SummaryStatistics` shape, and `LevelSelect` (`includeSubtotals`/`includeOverall`). Show a small grouped table. No figure required.

- [ ] **Step 9: Author `grouped-plots.md`** — cover `groupedHistogram` / `groupedKde`: the shared-domain idea (identical edges / sample points + one bandwidth derived from the overall distribution so series overlay cleanly). No `IoFigure` (it renders a single series); describe the shared-domain output and show the returned array shape.

- [ ] **Step 10: Verify build (no dead links yet — pages aren't linked until Task 7)**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors. Pages build even though nothing links to them yet.

- [ ] **Step 11: Commit**

```bash
git add apps/docs/guide
git commit -m "docs(docs): author Guide content pages"
```

---

## Task 5: Reference content pages

Hand-written API reference. For each export, read the actual signature/JSDoc from `packages/distribu-tron/src/*.ts` and document: signature, parameters, return shape, and the degenerate-input contract (`NaN` for scalars on empty/zero-mass, `[]` for arrays, `RangeError` on malformed input — non-finite value, negative weight, mismatched columnar lengths, `p ∉ [0,1]`).

**Files (create all):**
- `apps/docs/reference/index.md` — overview + full export map (mirror `src/index.ts`), grouped by area, each name linking to its section.
- `apps/docs/reference/distribution.md` — `distribution()`, `DistributionInput` forms, `DistributionOptions` (`sorted`, `profile`), the `Distribution` shape, `PrepTimings`.
- `apps/docs/reference/descriptives.md` — `mean, sum, min, max, range, variance, stdev, mode, mad, skewness, kurtosis`.
- `apps/docs/reference/quantiles-boxplot.md` — `quantile, median, quartiles, percentileRank` (+ `QuantileMethod`), `boxplot` (+ `BoxplotResult`).
- `apps/docs/reference/histogram-kde-ecdf.md` — `histogram` (+ `Bin`, `HistogramOptions`, `DEFAULT_MAX_AUTO_BINS`), `kde` (+ `KdePoint`, `KdeOptions`, `silvermanBandwidth`), `ecdf`/`cdf` (+ `EcdfPoint`).
- `apps/docs/reference/grouping.md` — `group, summarize, groupedHistogram, groupedKde` (+ `GroupSpec`, `GroupedDistribution`, `DistributionGroup`, `LevelSelect`, `SummaryStatistics`).
- `apps/docs/reference/utilities.md` — `summary` (+ `SummaryStatistics`), `time` (from `profile`).

- [ ] **Step 1: Author `reference/index.md`** with the export-map overview (copy the grouping from `src/index.ts`, link each name to `./<page>#<anchor>`).

- [ ] **Step 2: Author the six area pages** listed above. Per export, use this consistent structure:

````markdown
## `histogram(d, options?)`

Returns `Bin[]` — `{ x0, x1, weight }[]` — binning the distribution's mass.

**Parameters**
- `d: Distribution`
- `options.binCount?: number` — fixed bin count.
- `options.maxBins?: number` — cap on auto bins (default `DEFAULT_MAX_AUTO_BINS`).
- `options.rule?: "fd"` — Freedman–Diaconis bin-width rule (default).
- `options.edges?: number[]` — explicit bin edges; overrides the rule.

**Returns** `Bin[]`, weights conserved (Σ bin weight = `d.n`).

**Degenerate input** empty / zero-mass distribution → `[]`.
````

- [ ] **Step 3: Verify build**

Run: `cd apps/docs && pnpm build`
Expected: "build complete", no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/reference
git commit -m "docs(docs): author hand-written API reference pages"
```

---

## Task 6: Roadmap + home polish

**Files:**
- Create: `apps/docs/roadmap.md`
- Modify: `apps/docs/index.md` (remove the Task 3 smoke-test figure; restore real hero actions)

- [ ] **Step 1: Author `roadmap.md`** — distill `docs/designs/2026-06-08-package-design-and-roadmap.md` into a reader-facing roadmap (current capabilities + planned). Keep it a faithful summary, not a copy.

- [ ] **Step 2: Finalize the home page** — set `apps/docs/index.md` to the final hero with real internal links and remove the smoke-test `<IoFigure>`:

```markdown
---
layout: home
hero:
  name: distribu-tron
  text: Weighted distribution statistics
  tagline: Quantiles, descriptives, histogram, KDE, ECDF and grouped ROLLUP variants — straight from a frequency table.
  image:
    src: /logo.svg
    alt: distribu-tron
  actions:
    - theme: brand
      text: What is it?
      link: /guide/what-is-it
    - theme: alt
      text: Getting started
      link: /guide/getting-started
features:
  - title: Weighted by design
    details: Every statistic reads fractional weights. n is Σ weight, not a row count.
  - title: Plot-ready arrays
    details: histogram(), kde() and ecdf() return arrays you can render directly.
  - title: Prepared once, read many
    details: distribution() builds an immutable sorted substrate; readers never re-aggregate.
---
```

- [ ] **Step 3: Verify build**

Run: `cd apps/docs && pnpm build`
Expected: "build complete". The hero links resolve (target pages exist from Tasks 4).

- [ ] **Step 4: Commit**

```bash
git add apps/docs/roadmap.md apps/docs/index.md
git commit -m "docs(docs): add roadmap and finalize home page"
```

---

## Task 7: Finalize navigation & sidebar (IA)

Now that every target page exists, wire the full nav/sidebar and let VitePress's dead-link check validate the whole IA.

**Files:**
- Modify: `apps/docs/.vitepress/config.ts`

- [ ] **Step 1: Add `nav` and `sidebar` to `themeConfig`**

In `apps/docs/.vitepress/config.ts`, extend `themeConfig` (keep existing `logo`, `siteTitle`, `socialLinks`) with:

```ts
    nav: [
      { text: "Guide", link: "/guide/what-is-it" },
      { text: "Reference", link: "/reference/" },
      { text: "Roadmap", link: "/roadmap" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is distribu-tron?", link: "/guide/what-is-it" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "The model", link: "/guide/the-model" },
          ],
        },
        {
          text: "Statistics",
          items: [
            { text: "Descriptives", link: "/guide/descriptives" },
            { text: "Quantiles & box plot", link: "/guide/quantiles" },
            { text: "Shape & density", link: "/guide/shape-density" },
          ],
        },
        {
          text: "Grouping",
          items: [
            { text: "group() & ROLLUP", link: "/guide/grouping" },
            { text: "summarize()", link: "/guide/summarize" },
            { text: "Grouped plots", link: "/guide/grouped-plots" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Overview", link: "/reference/" },
            { text: "distribution()", link: "/reference/distribution" },
            { text: "Descriptives", link: "/reference/descriptives" },
            { text: "Quantiles & box plot", link: "/reference/quantiles-boxplot" },
            { text: "Histogram, KDE & ECDF", link: "/reference/histogram-kde-ecdf" },
            { text: "Grouping", link: "/reference/grouping" },
            { text: "Utilities", link: "/reference/utilities" },
          ],
        },
      ],
    },
```

- [ ] **Step 2: Verify the full build with dead-link checking**

Run: `cd apps/docs && pnpm build`
Expected: "build complete" with **no dead-link warnings**. If any link is dead, fix the target path or the link.

- [ ] **Step 3: Visual acceptance pass**

Run: `cd apps/docs && pnpm dev`. Open the site and compare against the vendored target `.vitepress/theme/vitepress-preview.html` (open that file directly in a browser too). Check: Orbitron wordmark, neon palette, grid backdrop, the `IoFigure` figures, light/dark toggle. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/.vitepress/config.ts
git commit -m "feat(docs): wire full nav and sidebar IA"
```

---

## Task 8: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/docs.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/docs.yml`:

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]
    paths:
      - "apps/docs/**"
      - "packages/distribu-tron/**"
      - ".github/workflows/docs.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.5.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build library
        run: pnpm -C packages/distribu-tron build
      - name: Build docs
        run: pnpm -C apps/docs build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: One-time repo setting (manual, out of band)**

In GitHub repo **Settings → Pages**, set **Source = GitHub Actions**. (Cannot be scripted here; note it for the user.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docs.yml
git commit -m "ci(docs): deploy VitePress site to GitHub Pages"
```

---

## Task 9: README link + final verification

**Files:**
- Modify: `README.md` (root)

- [ ] **Step 1: Add the docs link to the README**

Near the top of root `README.md` (under the title/badges), add:

```markdown
📖 **Documentation:** https://dm-p.github.io/distribu-tron/
```

- [ ] **Step 2: Full local verification**

Run from repo root:

```bash
pnpm -C packages/distribu-tron build
pnpm -C apps/docs build
```

Expected: both succeed; docs build has no dead links. Confirm `apps/docs/.vitepress/dist/index.html` exists.

- [ ] **Step 3: Confirm the package gates still pass**

Run: `cd packages/distribu-tron && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green (the docs work touched no library source).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: link the published documentation site in the README"
```

- [ ] **Step 5: (After merge to main) verify the live deploy**

After this branch merges to `main`, confirm the `Deploy Docs` workflow run is green and the site loads at `https://dm-p.github.io/distribu-tron/` with the `noindex` meta present (View Source → `<meta name="robots" content="noindex, nofollow">`).

---

## Notes for the executor

- **Build order is load-bearing.** The docs import the *built* `distribu-tron` (`dist/`). Always build the library before building/serving docs. If you see `Failed to resolve "distribu-tron"`, run `pnpm -C packages/distribu-tron build`.
- **Dead links fail the build.** That's why full nav/sidebar (Task 7) comes after all pages exist. If you must build earlier with links to not-yet-created pages, don't — follow the task order.
- **Don't edit vendored theme files** (`custom.css`, favicons, logos, `vitepress-preview.html`). Config and `IoFigure` consume them.
- **The `noindex` meta is temporary** — it's commented as such in `config.ts`. Removing it is a deliberate future "go public" step, not part of this plan.
- **Content fidelity:** prose is authored from `README.md` + `src/*.ts`. When a signature is unclear, read the source file — never invent parameters or return shapes.
