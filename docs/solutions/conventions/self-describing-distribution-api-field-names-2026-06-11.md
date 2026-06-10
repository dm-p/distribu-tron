---
title: "Rename public fields that need a disambiguation footnote"
date: 2026-06-11
category: docs/solutions/conventions/
module: distribution
problem_type: convention
component: documentation
severity: low
applies_when:
  - "Adding or renaming fields on a public TypeScript interface before the first stable release"
  - "A field name needs a disambiguation footnote to distinguish it from a sibling field"
  - "A name collides with both a language idiom (e.g. Set.size) and a domain term at once"
  - "Deciding whether to keep a terse conventional abbreviation (n, p) or expand it"
related_components:
  - tooling
tags:
  - api-naming
  - public-interface
  - typescript
  - distribution
  - weighted-statistics
  - rename
  - pre-publish
---

# Rename public fields that need a disambiguation footnote

## Context

During a deliberate pre-publish API naming review of `distribu-tron` (a zero-dependency,
ESM-only TypeScript library for weighted / pre-aggregated distribution statistics), two
public fields on the `Distribution` interface were renamed for clarity. The library builds
an immutable prepared substrate from a frequency table: a sorted, distinct `Float64Array` of
`values`, a parallel `weights` array, and a running-sum array, plus scalar metadata.

Before:

```ts
interface Distribution {
  size: number;             // count of distinct values — but easily confused with n
  cumulative: Float64Array; // inclusive Σweight prefix-sum — "cumulative of what?"
  n: number;                // total weight = Σ weights (the "effective sample size")
}
```

After:

```ts
interface Distribution {
  distinctCount: number;            // was: size
  cumulativeWeights: Float64Array;  // was: cumulative
  n: number;                        // unchanged
}
```

`n` was deliberately **kept**. The whole change was mechanical and behavior-preserving — the
112-test suite, typecheck, lint, and build all stayed green.

## Guidance

**When a public field's name requires a disambiguation footnote in its own documentation, the
name is underperforming — rename it to be self-describing.**

The diagnostic smell here was a docs line that read: "`size` is the number of distinct values,
**not** the total weight." If you have to tell a reader what a name does *not* mean in order to
separate it from a sibling field, the name is losing to its own context.

A checklist for naming (or renaming) a public data-structure field:

1. **Does the name collide with a common language or domain idiom for something nearby?**
   `size` collided twice at once: with the JS collection idiom (`Set.size`/`Map.size` →
   "number of entries") *and* with the statistics term "sample size" — which in this library is
   a *different* field, `n`. A reader had two wrong intuitions available before the correct one.
   `distinctCount` (mirroring SQL `COUNT(DISTINCT …)`) leaves only the right one.

2. **Can the name be misread as a different type?** Bare adjectives are a trap for counts. The
   candidate `distinct` scored well on disambiguation but failed type-readability:
   `if (d.distinct)` reads as a boolean predicate, not an integer count. Add a noun —
   `distinctCount` is unambiguous at every call site.

3. **Does the name answer "of what?"** `cumulative` is a fine adjective, but next to `weights`
   and `values` it leaves "cumulative of what?" open. `cumulativeWeights` answers itself, and
   because it parallels `weights` it signals "same shape, running sum."

4. **Is a short idiomatic name already carrying the right meaning?** If so, keep it. `n` was left
   alone on purpose: statisticians use `n` for sample size, and here Σweight *is* the effective
   sample size that type-7 weighted quantiles interpolate over. Renaming `n` → `totalWeight`
   would strip that domain-native meaning and break the quantile-rank story. Rename names that
   *mislead*; don't rename names that are merely *short*.

5. **Scope the rename to the public surface.** Internal free-function locals that merely share a
   word are not the public field and should stay. `weightedMedianSorted(values, cumulative, n)`
   keeps its generic `cumulative` parameter; the single bridging call site
   `weightedMedianSorted(d.values, d.cumulativeWeights, d.n)` makes the public→internal
   translation explicit. Don't over-rename internal generics.

## Why This Matters

Field names on a public data structure are the primary API surface — they show up in every
consumer's autocomplete, every hover tooltip, every destructuring assignment, and every doc
snippet. A misleading name is a standing cognitive tax: readers must remember what it *doesn't*
mean, and new contributors can't discover the caveat without reading prose.

The stakes here were concrete statistical bugs, not crashes:

- A reader reaching for `size` expecting the observation count would get an integer and could
  silently use it where `n` (Σweight) was required. Those differ whenever weights are
  non-uniform — wrong answer, no exception.
- `cumulative` unqualified could be mistaken for a cumulative *probability* array (values in
  `[0,1]`) rather than cumulative *weight* (values in `[0, n]`). Manual quantile interpolation
  against the wrong denominator would silently misread.

The pre-publish window is uniquely cheap for this: no downstream consumers to break, and the
TypeScript compiler enumerates every call site for you. Post-publish, the same fix costs a
semver-major plus a migration guide.

## When to Apply

Apply this rename discipline when all three hold:

- The field is on a **public, exported interface or type** (not an internal detail).
- It sits **alongside sibling fields** whose names could plausibly match the same concept.
- The name triggers **at least one wrong mental model** from language convention or domain
  vocabulary.

Highest-value moments: **pre-publish / early beta** (the rename is free); **during a deliberate
API surface audit** (keeps the diff clean); and **the moment you catch yourself drafting a
"not X" clause** in the docs.

Do *not* rename speculatively. A terse name that carries correct domain meaning (`n`, `min`,
`max`, `p`) should be left alone even when a longer alternative exists.

## Examples

**The trigger — a "not X" footnote in the docs:**

```ts
/** Number of distinct values. Not the total weight — that is `n`. */
size: number;   // the "not the total weight" clause is the signal the name has lost
```

**The boolean-adjective trap (why `distinct` was rejected for `distinctCount`):**

```ts
if (d.distinct) { ... }       // reads as "if the distribution is distinct" — wrong
const k = d.distinct * 2;     // feels like multiplying a boolean

if (d.distinctCount > 1) { ... }   // unambiguous at any call site
```

**The kept-`n` counter-decision:**

```ts
// rank(p) = p * n  →  binary search in cumulativeWeights for that rank.
// `n` carries the statistical identity (effective sample size); the doc
// comment confirms the formula instead of compensating for ambiguity.
/** Total weight: Σ weights. Equals the effective sample size for quantiles. */
n: number;
```

**Execution technique — the TypeScript compiler as a rename harness:**

```
1. Rename the field on the interface (types.ts)
2. pnpm tsc --noEmit   # red: the compiler lists every call site
3. Fix each call site  # mechanical, no logic changes
4. pnpm tsc --noEmit   # green
5. pnpm vitest run     # 112/112 — behavior-preserving confirmed
6. pnpm lint && pnpm build
```

The type system's exhaustiveness turns the rename into a guided checklist. No new tests are
needed for a mechanical rename with full pre-existing coverage — the passing suite is the proof.

## Related

- Design rationale: `docs/designs/2026-06-10-distribution-api-naming-design.md`
- Build plan: `docs/plans/2026-06-10-distribution-api-naming.md`
- Reinforces the existing repo invariant (`CLAUDE.md`): "the field is `weight`, never `count`;
  `n` is Σ weight, not a row count."
- Affected source: `packages/distribu-tron/src/types.ts`,
  `packages/distribu-tron/src/distribution.ts`
