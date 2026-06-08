import { bench, describe } from "vitest";
import { quantileSorted } from "d3-array";
import { quantile as ssQuantile } from "simple-statistics";
import { distribution, quantile } from "../src/index";

const N = 100_000;
const raw = Array.from({ length: N }, (_, i) => (i * 7919) % 1000);
const sorted = raw.slice().sort((a, b) => a - b);
const d = distribution(raw);

describe("quantile p50", () => {
  bench("distribu-tron (prepared)", () => {
    quantile(d, 0.5);
  });
  bench("distribu-tron (incl. prepare)", () => {
    quantile(distribution(raw), 0.5);
  });
  bench("d3-array quantileSorted", () => {
    quantileSorted(sorted, 0.5);
  });
  bench("simple-statistics quantile", () => {
    ssQuantile(raw, 0.5);
  });
});
