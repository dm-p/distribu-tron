---
layout: home
hero:
  name: distribu-tron
  text: Weighted distribution statistics
  tagline: Quantiles, descriptives, histogram, KDE, ECDF and grouped ROLLUP variants — straight from a frequency table.
  image:
    src: /logo.svg
    alt: distribu-tron
  actions:
    - theme: brand
      text: What is it?
      link: /guide/what-is-it
    - theme: alt
      text: Getting started
      link: /guide/getting-started
features:
  - title: Weighted by design
    details: Every statistic reads fractional weights. n is Σ weight, not a row count.
  - title: Plot-ready arrays
    details: histogram(), kde() and ecdf() return arrays you can render directly.
  - title: Prepared once, read many
    details: distribution() builds an immutable sorted substrate; readers never re-aggregate.
---

## A frequency table in, statistics out

Give `distribution()` a `{ value, weight }` table — the kind a SQL or DAX `GROUP BY` already
produces — then read plot-ready statistics straight off it. No raw samples, no re-aggregation.

```ts
import { distribution, mean, histogram } from "distribu-tron";

const d = distribution([
  { value: 1, weight: 2 },
  { value: 2, weight: 5 },
  { value: 3, weight: 8 },
  { value: 4, weight: 6 },
  { value: 5, weight: 3 },
  { value: 6, weight: 1 },
]);

mean(d);      // → 3.24  (weighted)
histogram(d); // → plot-ready bins, shown below
```

<IoFigure
  :input="[{value:1,weight:2},{value:2,weight:5},{value:3,weight:8},{value:4,weight:6},{value:5,weight:3},{value:6,weight:1}]"
  kind="histogram"
  :bins="6" />

New here? Start with [What is distribu-tron?](/guide/what-is-it).
