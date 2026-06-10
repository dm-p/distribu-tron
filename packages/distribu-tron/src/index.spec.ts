import { describe, it, expect } from "vitest";
import * as dt from "./index";

describe("public surface", () => {
  it("exports the v1 API", () => {
    for (const name of [
      "distribution",
      "mean",
      "sum",
      "min",
      "max",
      "range",
      "variance",
      "stdev",
      "mode",
      "mad",
      "skewness",
      "kurtosis",
      "quantile",
      "median",
      "quartiles",
      "percentileRank",
      "boxplot",
      "ecdf",
      "cdf",
      "histogram",
      "kde",
      "silvermanBandwidth",
      "summary",
      "time",
      "group",
      "summarize",
      "groupedHistogram",
      "groupedKde",
    ]) {
      expect(typeof (dt as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("exports scottBandwidth", () => {
    expect(typeof dt.scottBandwidth).toBe("function");
    expect(dt.scottBandwidth(100, 2)).toBeCloseTo(1.06 * 2 * Math.pow(100, -0.2), 12);
  });
});
