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
