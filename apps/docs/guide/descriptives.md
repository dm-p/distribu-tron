# Descriptives

The descriptive functions each take a `Distribution` and return a single number — all computed from
the weighted substrate, so `n` is the total weight (Σ weight), not a row count.

```ts
import {
  distribution,
  mean, sum, min, max, range,
  variance, stdev, mode, mad, skewness, kurtosis,
} from "distribu-tron";

const d = distribution([
  { value: 0, weight: 8 }, { value: 4, weight: 19 }, { value: 8, weight: 34 },
  { value: 12, weight: 49 }, { value: 16, weight: 58 }, { value: 20, weight: 52 },
  { value: 24, weight: 40 }, { value: 28, weight: 27 }, { value: 32, weight: 16 },
  { value: 36, weight: 8 }, { value: 40, weight: 4 },
]);
```

The KDE below shows the shape of that table alongside the numbers it summarizes:

<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="kde"
  caption="kde() of the exam-score table" />

## Center and spread

```ts
sum(d);    // Σ (value × weight)
mean(d);   // weighted mean = sum(d) / n
min(d);    // smallest value
max(d);    // largest value
range(d);  // max − min
```

`variance` and `stdev` are **population** statistics by default; pass `{ sample: true }` for the
sample (Bessel-corrected) form:

```ts
variance(d);                  // population variance
variance(d, { sample: true }); // sample variance (needs effective n > 1)
stdev(d);                     // population standard deviation
stdev(d, { sample: true });   // sample standard deviation
```

## Robust and shape statistics

```ts
mode(d);     // the value carrying the most weight
mad(d);      // median absolute deviation (weighted)
skewness(d); // third standardized moment
kurtosis(d); // fourth standardized moment, excess (normal ⇒ 0)
```

## Numerical stability

Every moment-based statistic (`mean`, `variance`, `stdev`, `skewness`, `kurtosis`, …) accumulates
its sums with **Neumaier compensated summation** rather than naive addition. Naive accumulation
drifts at large `n`; the compensated path keeps the result stable, and the library has tests
asserting that stable value.

## Degenerate input

An empty distribution, or one with zero total mass (`n ≤ 0`), has no defined statistics. In that
case every scalar descriptive returns **`NaN`** (and `min` is `+Infinity`, `max` is `−Infinity`).
This contract is uniform across the library, so you can branch on a single `Number.isNaN(...)` check
rather than special-casing each function.
