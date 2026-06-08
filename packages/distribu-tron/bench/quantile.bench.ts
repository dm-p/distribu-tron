import { bench, describe } from "vitest";
import { quantileSorted as d3QuantileSorted } from "d3-array";
import { quantile as ssQuantile, quantileSorted as ssQuantileSorted } from "simple-statistics";
import { distribution, quantile } from "../src/index";
import type { WeightedValue } from "../src/index";

const N = 100_000;
// ~1,000 distinct values, each repeated ~100x — a realistically pre-aggregatable shape.
const raw = Array.from({ length: N }, (_, i) => (i * 7919) % 1000);

// Prepared forms, each built ONCE — the steady state a library queries repeatedly.
const sorted = raw.slice().sort((a, b) => a - b); // d3 / simple-statistics: full sorted array
const prepared = distribution(raw); // distribu-tron: distinct values + cumulative weights

// A frequency table: 1,000 distinct values, weight 1,000 each — i.e. 1,000,000 observations already
// aggregated. This is the shape a SQL/DAX `GROUP BY value ORDER BY value` hands you.
const table: WeightedValue[] = Array.from({ length: 1000 }, (_, i) => ({ value: i, weight: 1000 }));
// A flat-array library cannot read the table; it must re-expand it to the 1,000,000 raw values it
// stands for. (Expanding a sorted table yields an already-sorted array, so no extra sort is charged.)
function expand(t: WeightedValue[]): number[] {
  const out: number[] = [];
  for (const { value, weight } of t) for (let i = 0; i < weight; i++) out.push(value);
  return out;
}

// (1) Every input already prepared; measure one p50 query on the hot path. Expect a ~tie.
describe("quantile p50 — prepared input (prep excluded)", () => {
  bench("distribu-tron", () => {
    quantile(prepared, 0.5);
  });
  bench("d3-array quantileSorted", () => {
    d3QuantileSorted(sorted, 0.5);
  });
  bench("simple-statistics quantileSorted", () => {
    ssQuantileSorted(sorted, 0.5);
  });
});

// (2) Four quantiles on a prepared input — shows repeated queries stay cheap once prep is paid.
const ps = [0.1, 0.5, 0.9, 0.99];
describe("4 quantiles (p10/p50/p90/p99) on a prepared input", () => {
  bench("distribu-tron", () => {
    for (const p of ps) quantile(prepared, p);
  });
  bench("d3-array quantileSorted", () => {
    for (const p of ps) d3QuantileSorted(sorted, p);
  });
  bench("simple-statistics quantileSorted", () => {
    for (const p of ps) ssQuantileSorted(sorted, p);
  });
});

// (3) From raw values, each call pays its own prep. distribu-tron is NOT the fastest here — a plain
// quickselect wins for a single quantile. Use the library on prepared data, not for this.
describe("quantile p50 — from raw values (prep included)", () => {
  bench("distribu-tron", () => {
    quantile(distribution(raw), 0.5);
  });
  bench("d3-array sort + quantileSorted", () => {
    d3QuantileSorted(
      raw.slice().sort((a, b) => a - b),
      0.5,
    );
  });
  bench("simple-statistics quantile", () => {
    ssQuantile(raw.slice(), 0.5);
  });
});

// (4) From an already-aggregated frequency table — distribu-tron's home turf. Flat-array libraries
// must materialize the 1,000,000 observations the table represents before they can do anything.
describe("quantile p50 — from a frequency table (aggregated input)", () => {
  bench("distribu-tron (consumes the table)", () => {
    quantile(distribution(table, { sorted: true }), 0.5);
  });
  bench("d3-array (expand → quantileSorted)", () => {
    d3QuantileSorted(expand(table), 0.5);
  });
  bench("simple-statistics (expand → quantile)", () => {
    ssQuantile(expand(table), 0.5);
  });
});
