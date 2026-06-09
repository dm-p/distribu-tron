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
