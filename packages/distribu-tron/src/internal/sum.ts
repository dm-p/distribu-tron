/** Neumaier (improved Kahan) compensated sum of an array. */
export function neumaierSum(values: ArrayLike<number>): number {
  let sum = 0,
    c = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const t = sum + v;
    c += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
    sum = t;
  }
  return sum + c;
}

/** Neumaier sum over a generated sequence `at(0..count-1)` (avoids allocating a temp array). */
export function neumaierSumMap(count: number, at: (i: number) => number): number {
  let sum = 0,
    c = 0;
  for (let i = 0; i < count; i++) {
    const v = at(i);
    const t = sum + v;
    c += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
    sum = t;
  }
  return sum + c;
}
