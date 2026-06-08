import { bench, describe } from "vitest";
import { bin } from "d3-array";
import { distribution, histogram } from "../src/index";
import type { WeightedValue } from "../src/index";

const N = 100_000;
// ~5,000 distinct values over a log-spread domain.
const raw = Array.from({ length: N }, (_, i) => Math.log1p((i * 7919) % 5000));
const prepared = distribution(raw);
const d3bin = bin();

// A frequency table: 5,000 distinct values, weight 200 each — i.e. 1,000,000 observations already
// aggregated (the shape a SQL/DAX `GROUP BY value ORDER BY value` hands you).
const table: WeightedValue[] = Array.from({ length: 5000 }, (_, i) => ({ value: Math.log1p(i), weight: 200 }));
function expand(t: WeightedValue[]): number[] {
  const out: number[] = [];
  for (const { value, weight } of t) for (let i = 0; i < weight; i++) out.push(value);
  return out;
}

// (1) From raw: both start from the unprepared array. distribu-tron is NOT the fastest here — it pays
// an aggregation pass d3.bin does not. Use the library on prepared data, not for this.
describe("histogram — from raw values (prep included)", () => {
  bench("distribu-tron", () => {
    histogram(distribution(raw));
  });
  bench("d3-array bin", () => {
    d3bin(raw);
  });
});

// (2) Prepared: distribu-tron bins its pre-built substrate. d3.bin has no prepared form — it always
// recomputes thresholds from the raw array — so there is no matching d3 row here.
describe("histogram — prepared input (distribu-tron steady-state)", () => {
  bench("distribu-tron", () => {
    histogram(prepared);
  });
});

// (3) From an already-aggregated frequency table — distribu-tron's home turf. d3.bin must first
// materialize the 1,000,000 observations the table represents.
describe("histogram — from a frequency table (aggregated input)", () => {
  bench("distribu-tron (consumes the table)", () => {
    histogram(distribution(table, { sorted: true }));
  });
  bench("d3-array bin (expand → bin)", () => {
    d3bin(expand(table));
  });
});
