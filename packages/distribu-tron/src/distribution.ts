import type { Distribution, DistributionInput, DistributionOptions, PrepTimings, WeightedValue } from "./types";

function isColumnar(x: DistributionInput): x is { values: ArrayLike<number>; weights?: ArrayLike<number> } {
  return !Array.isArray(x) && typeof x === "object" && x !== null && "values" in x;
}

type Collect = (value: number, weight: number) => void;

function validatePair(v: number, w: number): void {
  if (!Number.isFinite(v)) throw new RangeError(`value must be finite, got ${v}`);
  if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError(`weight must be a finite, non-negative number, got ${w}`);
}

function readColumnar(input: { values: ArrayLike<number>; weights?: ArrayLike<number> }, collect: Collect): void {
  const vs = input.values,
    ws = input.weights;
  if (ws && ws.length !== vs.length) {
    throw new RangeError(`columnar values and weights must be the same length, got ${vs.length} and ${ws.length}`);
  }
  for (let i = 0; i < vs.length; i++) collect(vs[i]!, ws ? ws[i]! : 1);
}

function readRows(input: Array<number | WeightedValue>, collect: Collect): void {
  for (const item of input) {
    if (typeof item === "number") collect(item, 1);
    else collect(item.value, item.weight);
  }
}

/** Pull (value, weight) pairs out of any supported input, validating as we go. */
function toPairs(input: DistributionInput): { values: number[]; weights: number[] } {
  const values: number[] = [];
  const weights: number[] = [];
  const collect: Collect = (v, w) => {
    validatePair(v, w);
    values.push(v);
    weights.push(w);
  };
  if (isColumnar(input)) readColumnar(input, collect);
  else readRows(input as Array<number | WeightedValue>, collect);
  return { values, weights };
}

/**
 * Build a prepared {@link Distribution} (sorted, distinct, Float64Array substrate + cumulative weights).
 *
 * Contract notes:
 * - `n` is the total **weight** (Σ weights), which equals the count only for unit-weight input.
 * - Zero weights are permitted; they contribute a flat step to `cumulative`.
 * - `options.sorted: true` is a fast path that trusts the caller's input is already **ascending and
 *   distinct** and skips aggregation/sorting. Passing unsorted or duplicate data with this flag yields
 *   an undefined (incorrect) substrate — it is not validated, by design.
 *
 * @throws {RangeError} if any value is non-finite, any weight is negative/non-finite, or columnar
 *   `values`/`weights` differ in length.
 */
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
    if (options.profile) {
      aggregateMs = tAgg - t1;
      sortMs = performance.now() - tAgg;
    }
  }

  const distinctCount = values.length;
  const cumulativeWeights = new Float64Array(distinctCount);
  let running = 0;
  for (let i = 0; i < distinctCount; i++) {
    running += weights[i]!;
    cumulativeWeights[i] = running;
  }

  const timings: PrepTimings | undefined = options.profile
    ? { validateMs: t1 - t0, aggregateMs, sortMs, totalMs: performance.now() - t0 }
    : undefined;

  return {
    distinctCount,
    n: running,
    min: distinctCount ? values[0]! : Infinity,
    max: distinctCount ? values[distinctCount - 1]! : -Infinity,
    values,
    weights,
    cumulativeWeights,
    ...(timings ? { timings } : {}),
  };
}
