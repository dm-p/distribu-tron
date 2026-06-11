---
title: "Generalize a prefix-ROLLUP engine to CUBE by parameterizing the active-dimension subset"
date: 2026-06-11
category: docs/solutions/design-patterns
module: grouping and rollup
problem_type: design_pattern
component: service_object
severity: medium
applies_when:
  - "Extending a prefix/hierarchical ROLLUP to orthogonal margins or full CUBE grouping-sets"
  - "Adding a rollup mode to an existing engine without forking the accumulation logic"
  - "An existing special case must stay byte-for-byte identical after the generalization"
  - "Consumers select output by level/depth and should need zero changes when the engine widens"
  - "The engine merges leaf frequency tables bottom-up and re-scanning raw rows would be costly"
tags:
  - grouping
  - rollup
  - olap-cube
  - margins
  - generalization
  - active-subset
  - design-pattern
  - statistics
---

# Generalize a prefix-ROLLUP engine to CUBE by parameterizing the active-dimension subset

## Context

`group(rows, { by, rollup: true })` in distribu-tron used a prefix-ROLLUP strategy: it emitted one
subtotal per prefix of the `by` array, rolling dimensions up right-to-left. For a 2-D facet
`by: ["Gender", "Continent"]` this produced the grand total plus the `["Gender"]` marginal (Gender
held, Continent rolled up), but the orthogonal `["Continent"]` marginal (Continent held, Gender
rolled up) was never computed. The result was L-shaped: the `(All)` row existed but the `(All)`
column did not, so a faceted view expecting symmetric `(All)` margins on both axes had a structural
gap. Closing it meant going from prefix subtotals to full cross-tab coverage (SQL `GROUP BY CUBE`),
without breaking existing `rollup: true` callers.

The underlying observation generalizes past this one library: **a hierarchical/prefix aggregation is
just one member of the family of all grouping-sets.** Rather than bolt on a second code path for the
new shapes, parameterize the thing that varies - which dimensions are active (held) vs rolled up -
and let the old behavior fall out as one configuration of the general enumerator.

## Guidance

Replace the "roll up to depth k" loop with an "emit grouping-set S" loop, where S is any subset of
dimension indices. The old prefix behavior becomes one subset-generator mode; cube, margins, and any
future mode are others. Three small primitives carry the whole change.

**1. Subset enumerator.** One function decides, per mode, which active-dimension index subsets to emit
(leaves = the full set and the grand total = the empty set are emitted separately). Emit order is part
of the contract: descending size (deepest first), then ascending lexicographic by active-index
position.

```ts
type RollupMode = "prefix" | "margins" | "cube";

// k-combinations of [0, n) in lexicographic order, e.g. combinations(3, 2) -> [0,1] [0,2] [1,2]
function* combinations(n: number, k: number): Generator<number[]> {
  const combo = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield [...combo];
    let i = k - 1;
    while (i >= 0 && combo[i] === i + n - k) i--;
    if (i < 0) return;
    combo[i]++;
    for (let j = i + 1; j < k; j++) combo[j] = combo[j - 1] + 1;
  }
}

function subtotalSubsets(n: number, mode: RollupMode): number[][] {
  const subsets: number[][] = [];
  for (let size = n - 1; size >= 1; size--) {
    if (mode === "margins" && size !== 1) continue; // margins: size-1 subsets only
    if (mode === "prefix") {
      subsets.push(Array.from({ length: size }, (_, i) => i)); // one prefix [0..size-1] per size
    } else {
      for (const combo of combinations(n, size)) subsets.push(combo); // cube: every subset of each size
    }
  }
  return subsets;
}
```

The emit-order contract is split across these two functions: `subtotalSubsets`'s outer loop gives the
descending-size half, and `combinations` gives the ascending-lexicographic order within a size. Swap the
combination iterator and you change the order downstream consumers depend on.

**2. Active-set key builder.** The only change from the prefix version is replacing the prefix test
`i < depth` with set membership `active.has(i)`. For prefix mode the active set is always
`{0, 1, ..., k-1}`, so `active.has(i)` is identical to `i < depth` and the output is unchanged.

```ts
// rolled-up dimensions (those NOT in `active`) take the cosmetic totalLabel
function rolledKey(
  dimensions: string[],
  leafKey: Record<string, unknown>,
  active: Set<number>,
  totalLabel: unknown,
): Record<string, unknown> {
  const key: Record<string, unknown> = {};
  for (let i = 0; i < dimensions.length; i++) {
    key[dimensions[i]] = active.has(i) ? leafKey[dimensions[i]] : totalLabel;
  }
  return key;
}
```

**3. Mode resolver.** Map the public option to the internal mode, keeping the old boolean as an alias
so existing callers are untouched.

```ts
function resolveRollupMode(
  rollup: boolean | "prefix" | "margins" | "cube" | undefined,
): RollupMode | null {
  if (rollup === true || rollup === "prefix") return "prefix";
  if (rollup === "margins") return "margins";
  if (rollup === "cube") return "cube";
  return null; // false / undefined -> leaves only
}
```

The subtotal loop then iterates `subtotalSubsets(n, mode)`, builds `active = new Set(activeIdx)`, merges
the leaf frequency tables that share that active-dimension key, and tags each result group with
`level` (the active dimension names) and `depth` (= `level.length`).

Five insights make the generalization safe and cheap:

1. **Generalize, don't fork.** `subtotalSubsets(n, "prefix")` yields exactly `[0..k-1]` for each size,
   and `active.has(i)` for `{0..depth-1}` equals `i < depth`, so the prefix output is mathematically
   identical. Lock it with a normalized deep-equality test of `rollup: true` vs `rollup: "prefix"`
   output. There is no parallel code path to drift.

2. **Merge-up, don't re-scan.** Build the leaf frequency tables once; each grouping-set row is the merge
   of the `{value, weight}` pairs from the leaves that share its active-dimension key. Cost is
   `O(leaves x |grouping-sets|)` with no raw-row re-scan - up to `O(leaves x 2^N)` for cube. The
   `"margins"` mode (size-1 active sets only, linear in N) is the escape hatch when `2^N` is prohibitive.

3. **Disambiguate by level/depth, never the key string.** Rolled dimensions take a cosmetic `totalLabel`
   (default `null`). CUBE *widens* the collision surface versus prefix because it now also rolls the
   leading dimension, so a real value equal to `totalLabel` can appear at two different depths under the
   same rendered key. Consumers must switch on `level`/`depth`, not on the formatted key.

4. **Downstream consumers need zero change.** Aggregating consumers select groups by `depth`
   (`0 < depth < N`) and derive any shared domain (histogram edges, KDE bandwidth) from the
   mode-independent grand-total substrate. New orthogonal margins are just more groups over that same
   substrate, so the consumers pick them up for free.

5. **Name and test the degeneracies.** For `N <= 2`, `"margins"` equals `"cube"` (every non-grand,
   non-leaf subset has size 1). For `N = 1`, all modes collapse to leaves + grand total. Document and
   test these so callers are not surprised by output-count differences at small N.

## Why This Matters

- **Back-compat is structural, not hoped-for.** Treating prefix as one mode of the subset engine means
  zero behavioral change for existing callers, provable by locking the old output in a characterization
  test. A forked "cube path" would have been a second accumulator to keep in sync, and it would have
  drifted.
- **No row re-scan.** Margins are merged from already-computed leaf frequency tables, so adding the
  orthogonal marginals costs work proportional to the number of distinct leaves, not to the raw dataset
  size.
- **Deterministic, testable ordering.** The descending-size, ascending-lexicographic contract makes the
  grouping-set sequence fully predictable, lockable in tests, and puts `(All)` rows in consistent
  positions for faceted UIs regardless of dimension count or mode.
- **Zero consumer churn.** Because consumers key off `depth` rather than key content, they are
  mode-agnostic; the new margins are transparent to them.
- **The collision footgun is contained.** Documenting `level`/`depth` as the authoritative discriminator
  steers callers away from key-string equality before they hit the (now wider) `totalLabel` collision
  surface.

## When to Apply

Apply this pattern when:

- An existing prefix-ROLLUP or hierarchical aggregation (SQL `ROLLUP`, an OLAP cube, a pivot engine)
  needs symmetric `(All)` margins in every dimension independently - the classic cross-tab "row totals
  and column totals" shape.
- You want to add the new shapes without forking the accumulation engine and without breaking existing
  callers.
- The engine already merges leaf tables bottom-up, so margins can be computed without re-scanning raw
  rows.
- A faceted visualization or pivot UI must show grand-total rows/columns on all axes, not just the
  leading one.

Be cautious or prefer a narrower mode when:

- **N is large.** `2^N` grouping-sets become prohibitive; use the linear `"margins"` mode for
  single-dimension marginals instead of full cube.
- **There is a single grouping dimension.** prefix, margins, and cube all collapse to leaves + grand
  total, so the generalization adds machinery for no gain.
- **Consumers currently rely on the rolled-up label being unique across rows.** Cube creates more
  same-key/different-depth collisions; migrate those consumers to `depth`-based disambiguation first.

## Examples

**2-D facet: prefix (before) vs cube (after).** Rows cross-tabulated by `Gender` (M, F) and `Continent`
(NA, EU):

```text
prefix (rollup: true):
  level ["Gender","Continent"]  {Gender:M, Continent:NA}    <- leaf
  level ["Gender","Continent"]  {Gender:M, Continent:EU}    <- leaf
  level ["Gender","Continent"]  {Gender:F, Continent:NA}    <- leaf
  level ["Gender","Continent"]  {Gender:F, Continent:EU}    <- leaf
  level ["Gender"]              {Gender:M, Continent:(All)}  <- M across all continents
  level ["Gender"]              {Gender:F, Continent:(All)}  <- F across all continents
  level []                      {Gender:(All), Continent:(All)}  <- grand total

  Missing: level ["Continent"] - the orthogonal "all genders, NA" and "all genders, EU" margins.

cube (rollup: "cube"):
  -- same four leaf rows --
  level ["Gender"]              {Gender:M, Continent:(All)}
  level ["Gender"]              {Gender:F, Continent:(All)}
  level ["Continent"]           {Gender:(All), Continent:NA}     <- NEW orthogonal margin
  level ["Continent"]           {Gender:(All), Continent:EU}     <- NEW orthogonal margin
  level []                      {Gender:(All), Continent:(All)}
```

The cube output is symmetric: every dimension has its own `(All)` subtotals, so the facet can draw both
the row-total column and the column-total row.

**N=3 cube vs margins divergence.** For `by: ["A","B","C"]`, the distinct levels emitted (deepest first,
then ascending active-index position) are:

```text
cube:    ["A|B|C", "A|B", "A|C", "B|C", "A", "B", "C", ""]   (all 2^3 grouping-sets)
margins: ["A|B|C",               "A", "B", "C", ""]           (single-dimension margins only)
```

Cube adds the three size-2 faces (`A|B`, `A|C`, `B|C`); margins keeps only the single-dimension
marginals. For `N = 2` cube's only non-grand, non-leaf subsets are size-1, so cube and margins coincide.

## Related

- [SD-normalized multi-kernel KDE: bandwidth = kernel standard deviation](sd-normalized-multi-kernel-kde-registry-2026-06-10.md) - sibling design-pattern in the same `group.ts`/prepared-substrate area; shares the "resolve the mode once, no forked code path" shape (`resolveKernel` there, `resolveRollupMode` here).
- [CUBE / Orthogonal Rollup Design](../../designs/2026-06-10-cube-rollup-design.md) - the design spec this pattern was derived from.
- [CUBE / Orthogonal Rollup Implementation Plan](../../plans/2026-06-11-cube-rollup.md) - the task-by-task build plan.
- Source: `packages/distribu-tron/src/group.ts` (`combinations`, `subtotalSubsets`, `resolveRollupMode`, `rolledKey`, `rollupSubtotals`); tests in `group.spec.ts` and `group-consumers.spec.ts`.
