---
title: "Benchmark apples-to-apples: identical input state per regime, then let honest numbers drive positioning"
date: 2026-06-08
category: best-practices
module: distribu-tron benchmarks
problem_type: best_practice
component: testing_framework
severity: high
related_components:
  - documentation
applies_when:
  - "Benchmarking a library that prepares or indexes data against libraries that take raw input"
  - "Reporting headline speedup multipliers derived from a single benchmark regime"
  - "Adding a benchmark group that mixes contestants operating on different input states"
  - "Writing a README performance section whose numbers come straight from bench output"
  - "Positioning a specialized data structure against general-purpose alternatives"
tags:
  - benchmarking
  - performance
  - vitest-bench
  - apples-to-oranges
  - positioning
  - distribu-tron
  - testing-framework
---

# Benchmark apples-to-apples: identical input state per regime, then let honest numbers drive positioning

## Context

`distribu-tron` is a library for weighted / pre-aggregated distribution statistics built on a prepared
`Distribution` substrate (distinct values + cumulative weights, built once and queried many times). Its
first `vitest bench` suite compared distribu-tron's **prepared** structure against libraries operating
**from raw arrays** — e.g. our prepared `histogram(d)` versus d3-array's `bin(rawArray)` — and reported
headline numbers like "~100× faster than d3-array bin" and "~5,500× faster than simple-statistics."

Those multipliers were technically accurate but structurally dishonest: they measured the *absence of
preparation cost* on one side, not the cost of the operation. When the benchmark was restructured so every
contestant entered each group with the **same input state**, the multipliers collapsed or inverted — a
prepared single-quantile query became a three-way tie, and four prepared quantiles ran 2.4× *slower* than
d3. The library's genuine, defensible win (consuming an already-aggregated frequency table without
re-expanding it) only became visible once the regimes were separated.

## Guidance

1. **Define regimes before writing a single `bench()`.** A regime is an (input state, operation) pair.
   Every library in a group must enter that group with identical input state. Typical regimes: *from raw*,
   *prepared / pre-indexed (prep excluded)*, *prepared (prep included)*, and *your native input shape*
   (here: an aggregated `{value, weight}[]` table). Write the headings first; fill in contestants second.

2. **Never mix input states within a group.** The thing that is free for one contestant must be free for
   all, or paid by all. If your library queries a pre-built index, the library must also be pre-built in
   that group — or you must both be in the *from raw* group where neither is.

3. **Always benchmark the scenario that is your real value proposition.** A library for aggregated/weighted
   data needs a group whose input *is* an aggregated/weighted table — not a raw array you happened to
   aggregate first. That is the number that actually matters to your users.

4. **Report multiple regimes as a table, not one headline multiplier.** One row per regime, one column per
   library. The shape forces honesty: readers see where you win, tie, and lose.

5. **Let the numbers drive positioning — not the reverse.** If prepared single-quantile is a tie, say so.
   If aggregated input is 400×, attach that number to the specific scenario that produces it, never as a
   bare headline.

6. **Add a "when *not* to use this" section.** An honest performance story for a specialized library must
   name the cases where conventional tools win. Omitting them trains users to misapply the library, then
   distrust every number once they hit reality.

7. **Pin measurement conditions** (N, runtime/version, hardware class, bench-runner version). A multiplier
   without conditions is marketing, not engineering.

## Why This Matters

Misleading benchmarks cause two distinct harms. First, users adopt the library for cases it's bad at — they
pick it on the headline, hit disappointment (or unsupported input), and distrust the project. Second, the
inflated numbers evaporate the moment a rigorous reviewer restructures the bench, turning a credibility
asset into a liability. For a *specialized* library — one that trades generality for depth on a specific
data shape — an honest, narrow, well-scoped performance story is the only one that survives contact with
users who read the code. Naming where you lose is what makes the place you win believable.

## When to Apply

- Your library does setup / indexing / sorting / aggregation before the measured operation and another
  does not (or does it differently).
- Your input type differs structurally from the other's (you take `{value, weight}[]`; they take
  `number[]`).
- You're writing README performance claims with multipliers against named libraries.
- A reviewer or user asks whether a benchmark is "fair" — that question means regimes have been mixed.
- You're benchmarking any read-/query-heavy thing (indexes, caches, prepared statements, compiled regexes,
  tries) against something that works from scratch.

Do **not** use "fairness" as an excuse to omit unfavorable regimes — the goal is completeness, not flattery.

## Examples

**Misleading bench (before)** — distribu-tron arrives prepared, d3 arrives raw; the timed regions measure
different things:

```ts
// one "histogram" group, mixed input state
const prepared = distribution(raw);       // prep done OUTSIDE the timed region
const d3bin = bin();                      // d3's configured generator — recomputes thresholds per call
bench("distribu-tron (prepared)", () => histogram(prepared));
bench("d3-array bin", () => d3bin(raw));  // prep (threshold compute) INSIDE the timed region
```

**Fair bench (after)** — separate groups, identical input state within each:

```ts
// (1) prepared: every contestant pre-built, prep excluded
bench("distribu-tron", () => quantile(prepared, 0.5));
bench("d3-array quantileSorted", () => d3QuantileSorted(sorted, 0.5));
bench("simple-statistics quantileSorted", () => ssQuantileSorted(sorted, 0.5));

// (2) from raw: every contestant pays its own prep
bench("distribu-tron", () => quantile(distribution(raw), 0.5));
bench("d3-array sort + quantileSorted", () => d3QuantileSorted(raw.slice().sort((a, b) => a - b), 0.5));
bench("simple-statistics quantile", () => ssQuantile(raw.slice(), 0.5));

// (3) from a frequency table (the real value proposition): distribu-tron builds the substrate directly
//     ({ sorted: true } trusts the table's order); flat-array libraries must first re-expand it.
bench("distribu-tron (consumes the table)", () => quantile(distribution(table, { sorted: true }), 0.5));
bench("d3-array (expand → quantileSorted)", () => d3QuantileSorted(expand(table), 0.5));
bench("simple-statistics (expand → quantile)", () => ssQuantile(expand(table), 0.5));
```

**The honest result** (N = 100k observations, Node 24, single machine — indicative). Note the *units* differ
by regime: "prepared" queries run in nanoseconds (millions of ops/s); "from raw" / "from table" pay an
O(n) build each call (hundreds-to-thousands of ops/s):

| regime | distribu-tron | d3-array | simple-statistics |
|---|--:|--:|--:|
| quantile, prepared, single | ~20.1M ops/s | ~19–21M ops/s | ~18.8M ops/s |
| quantile, prepared, ×4 (p10/50/90/99) | ~6.0M ops/s | **~14.4M (2.4× faster)** | ~11.5M ops/s |
| quantile, from raw, single | ~320 ops/s | ~85 ops/s | **~2,500 (8× faster)** |
| quantile, from frequency table | **~64,600 ops/s** | ~152 ops/s | ~110 ops/s |
| histogram, from raw | ~193 ops/s | **~637 (3.2× faster)** | — |
| histogram, from frequency table | **~7,800 ops/s** | ~43 ops/s | — |

**Misleading README framing (before):**

> Performance: ~100× faster than d3-array `bin` and ~5,500× faster than simple-statistics.

**Honest README framing (after)** — a "Performance — and when *not* to use this" section that states the
tie, names where conventional libraries win (raw, one-shot), and attaches the big multipliers (~425× vs d3,
~590× vs simple-statistics for a frequency-table quantile) to the *specific* aggregated-input scenario that
produces them. A top-of-README "useful for / less useful for" callout sets expectations before the reader
reaches the numbers.

## Related

- `docs/plans/2026-06-08-package-build-plan.md` — Task 20 (benchmark suite)
- `packages/distribu-tron/bench/quantile.bench.ts`, `bench/histogram.bench.ts` — the regime-split benches
- `packages/distribu-tron/README.md` — the "Performance — and when not to use this" section
