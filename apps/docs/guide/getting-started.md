# Getting started

`distribu-tron` is a zero-dependency, ESM-only library. Install it from npm:

```bash
npm i distribu-tron
```

It works on **already-aggregated** data — a frequency table of `{ value, weight }` — rather than a
raw sample array. Build a `Distribution` once, then read many statistics off it.

```ts
import { distribution, mean, median, histogram } from "distribu-tron";

const scores = distribution([
  { value: 0, weight: 8 },
  { value: 4, weight: 19 },
  { value: 8, weight: 34 },
  { value: 12, weight: 49 },
  { value: 16, weight: 58 },
  // …
]);

mean(scores);   // weighted mean
median(scores); // weighted median
histogram(scores); // → Bin[] ready to plot
```

Every reader function takes a `Distribution` and never re-sorts or re-aggregates. The histogram
below is computed from the table above — no raw samples involved:

<IoFigure
  :input="[{value:0,weight:8},{value:4,weight:19},{value:8,weight:34},{value:12,weight:49},{value:16,weight:58},{value:20,weight:52},{value:24,weight:40},{value:28,weight:27},{value:32,weight:16},{value:36,weight:8},{value:40,weight:4}]"
  kind="histogram"
  caption="11 bins · weights conserved" />
