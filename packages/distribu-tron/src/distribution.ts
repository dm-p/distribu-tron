import type { Distribution, DistributionInput, DistributionOptions, PrepTimings, WeightedValue } from "./types";

function isColumnar(x: DistributionInput): x is { values: ArrayLike<number>; weights?: ArrayLike<number> } {
  return !Array.isArray(x) && typeof x === "object" && x !== null && "values" in x;
}

/** Pull (value, weight) pairs out of any supported input, validating as we go. */
function toPairs(input: DistributionInput): { values: number[]; weights: number[] } {
  const values: number[] = [];
  const weights: number[] = [];
  const pushPair = (v: number, w: number) => {
    if (!Number.isFinite(v)) throw new RangeError(`value must be finite, got ${v}`);
    if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError(`weight must be a finite, non-negative number, got ${w}`);
    values.push(v); weights.push(w);
  };
  if (isColumnar(input)) {
    const vs = input.values, ws = input.weights;
    if (ws && ws.length !== vs.length) {
      throw new RangeError(`columnar values and weights must be the same length, got ${vs.length} and ${ws.length}`);
    }
    for (let i = 0; i < vs.length; i++) pushPair(vs[i]!, ws ? ws[i]! : 1);
  } else {
    for (const item of input as Array<number | WeightedValue>) {
      if (typeof item === "number") pushPair(item, 1);
      else pushPair(item.value, item.weight);
    }
  }
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
  if (options.sorted) {
    // Caller guarantees ascending & distinct: no aggregate, no sort.
    values = Float64Array.from(rawV);
    weights = Float64Array.from(rawW);
  } else {
    // Aggregate duplicates into a map, then sort the distinct keys.
    const merged = new Map<number, number>();
    for (let i = 0; i < rawV.length; i++) merged.set(rawV[i]!, (merged.get(rawV[i]!) ?? 0) + rawW[i]!);
    const keys = Array.from(merged.keys()).sort((a, b) => a - b);
    values = Float64Array.from(keys);
    weights = Float64Array.from(keys, (k) => merged.get(k)!);
  }
  const t2 = options.profile ? performance.now() : 0;

  const size = values.length;
  const cumulative = new Float64Array(size);
  let running = 0;
  for (let i = 0; i < size; i++) { running += weights[i]!; cumulative[i] = running; }

  const timings: PrepTimings | undefined = options.profile
    ? { validateMs: t1 - t0, aggregateMs: 0, sortMs: t2 - t1, totalMs: performance.now() - t0 }
    : undefined;

  return {
    size,
    n: running,
    min: size ? values[0]! : Infinity,
    max: size ? values[size - 1]! : -Infinity,
    values, weights, cumulative,
    ...(timings ? { timings } : {}),
  };
}
