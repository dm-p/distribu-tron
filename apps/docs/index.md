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
