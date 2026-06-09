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
