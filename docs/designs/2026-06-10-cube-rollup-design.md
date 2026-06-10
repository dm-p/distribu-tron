# distribu-tron — CUBE / Orthogonal Rollup Design

**Date:** 2026-06-11 (refined from the 2026-06-10 draft)
**Status:** Approved — ready for planning
**Relates to:** `docs/designs/2026-06-08-package-design-and-roadmap.md` — promotes **Phase 5 · grouping extras** (CUBE / arbitrary grouping-sets) forward, ahead of schedule.

> Pulled forward because the first real consumer (`rayfin-distribution-stats`, the
> Distribution Explorer) needs orthogonal margins now and is carrying a client-side
> workaround that this feature deletes (see "What this replaces").

## Problem

`group(rows, { by, rollup: true })` emits **prefix ROLLUP** subtotals only — it rolls
dimensions up **right-to-left**, so an N-dimension group yields N+1 levels (leaves + one
subtotal per prefix + grand total). For `by: ["Gender", "Continent"]`:

| `level` (`depth`) | keys produced |
|---|---|
| `["Gender","Continent"]` (2) | `{Gender: female, Continent: NA}`, `{female, Europe}`, `{male, NA}`, … (leaves) |
| `["Gender"]` (1) | `{female, (All)}`, `{male, (All)}` — `Continent` rolled up |
| `[]` (0) | `{(All), (All)}` — grand total |

**What's missing:** `{(All), NA}`, `{(All), Europe}`, `{(All), Australia}` — the marginal
over `Gender`, i.e. `level: ["Continent"]`. Prefix ROLLUP never produces it.

For a 2-D facet (`column = Gender`, `row = Continent`) this is **L-shaped**: the `(All)`
*row* is fully populated, but the `(All)` *column* has only the single grand-total cell.
The single-dimension case looks perfect because there's only one axis to roll up; 2-D
exposes the gap. In SQL terms `rollup: true` is `GROUP BY ROLLUP(a, b)`; facets want
`GROUP BY CUBE(a, b)` — every marginal, symmetric on all axes.

## Goal

Let `group()` emit **orthogonal margins** — all grouping-sets, not just prefixes — so a
consumer gets a complete cross-tab (both `(All)` row and `(All)` column populated). The
core `Distribution` primitive and the `GroupedDistribution` / `DistributionGroup` shapes
are **unchanged**; this only changes *which* groups `group()` produces.

The existing data model already supports this. `DistributionGroup.level` is documented as
"dimensions ACTIVE (not rolled up) here — canonical, collision-proof", and
`depth = level.length`. Prefix ROLLUP just happens to only ever emit `level`s that are
*prefixes* of `by`. CUBE emits `level`s that are *any subset* of `by`. Nothing downstream
needs new fields — disambiguation is still `level` / `depth`, never the key string.

## API

Widen the existing `rollup` slot rather than add a parallel option (keeps `GroupSpec` tidy
and is fully backward-compatible — `boolean` still works):

```ts
interface GroupSpec {
  by: string | string[];
  value: Accessor<number>;
  weight?: Accessor<number>;
  rollup?: boolean | "prefix" | "margins" | "cube";  // default false (leaves only)
  totalLabel?: string | null;
  sorted?: boolean;
}
```

| `rollup` | levels emitted | level count (N dims) | meaning |
|---|---|---|---|
| `false` / omitted | leaves | 1 | no subtotals (today) |
| `true` / `"prefix"` | leaves + prefix subtotals + grand | N + 1 | hierarchical ROLLUP (today; **unchanged**) |
| `"margins"` | leaves + each **single**-dimension margin + grand | N + 2 | every one-dimension margin; linear in N |
| `"cube"` | **all** grouping-sets | 2^N | full OLAP CUBE |

- `true === "prefix"` so existing callers are untouched.
- For **N ≤ 2** (the facet case) `"margins"` and `"cube"` are **identical** — both give the
  symmetric cross-tab. They diverge only at 3+ dims, where `"cube"` adds the intermediate
  multi-dimension faces (e.g. `{a, b, (All)}` at depth 2) and `"margins"` does not.
- For **N = 1** all of `"prefix"` / `"margins"` / `"cube"` collapse to the same output
  (`leaves + grand`) — there is only one axis to roll up.
- **`"cube"`** is the headline (matches the roadmap wording and OLAP expectations) and
  **`"margins"`** is the linear-cost escape hatch for high-cardinality / many dimensions
  where `2^N` grouping-sets would explode. The immediate consumer (the explorer, capped at
  2 dims) is fully served by either, since they coincide there.

### Concrete output — `by: ["Gender", "Continent"]`, `rollup: "cube"`, `totalLabel: "(All)"`

```
level ["Gender","Continent"] depth 2 : {female,NA} {female,Europe} {female,Australia} {male,NA} ...   (leaves)
level ["Gender"]             depth 1 : {female,(All)} {male,(All)}                                     (Continent margin)
level ["Continent"]          depth 1 : {(All),NA} {(All),Europe} {(All),Australia}                     (Gender margin — NEW)
level []                     depth 0 : {(All),(All)}                                                   (grand total)
```

(For N = 2, `rollup: "margins"` produces this exact same set.)

## Semantics

- **`level` = the active (non-rolled-up) dimensions** for the group, in `by` order. CUBE
  emits one set of groups per subset of `by`. `depth = level.length` exactly as today
  (`0` = grand total, `dimensions.length` = leaf).
- **`key`** spreads the active dimension values; rolled-up dimensions take `totalLabel`
  (default `null`) — cosmetic only. The **disambiguation rule is unchanged**: consumers
  switch on `level` / `depth`, never on the key string (handles `totalLabel` colliding with
  a real value, same as prefix today).
- **Computation — merge up, don't re-scan.** Build leaves once, then aggregate every other
  grouping-set by merging child frequency tables, mirroring (and generalizing) the existing
  prefix implementation ("Subtotals are computed by merging child leaf frequency tables up
  the hierarchy (cheap), not by re-scanning rows"). For each grouping-set, merge the leaf
  tables that share its active-dimension key — still no row re-scan; reuse the leaf
  distributions' `{value, weight}` substrate. Prefix is just the special case where the
  active set is always a *prefix* of `by`.
- **Ordering.** Emit **deepest → shallowest** (`leaves`, then subtotals by descending
  `depth`, then grand total). **Among levels at the same depth, emit in ascending
  active-position lexicographic order** — i.e. order by the positions of the active
  dimensions within `by`. At depth 1 for `["Gender","Continent"]` that is `["Gender"]`
  (active `{0}`) before `["Continent"]` (active `{1}`); at N = 3, depth 2 emits `[a,b]`,
  `[a,c]`, `[b,c]`. Within a single level, keep the existing key (group-insertion) order.
  This rule is deterministic, makes prefix output unchanged (prefix has exactly one level
  per depth), and keeps `"(All)"` sorting to the natural first row/column under a nominal
  facet sort (parens sort before digits and letters), which gives the margin its
  conventional top-left placement.
- **`GroupedDistribution.leaves` / `.overall`** are unchanged — `leaves` is still the finest
  level, `overall` the grand-total distribution.

## Implementation shape

Generalize the existing prefix machinery in `src/group.ts` rather than fork it — the
merge-up logic is already correct; it is only hardwired to prefixes.

- **`rollupSubtotals` becomes subset-driven.** Today it walks `dimensions.slice(0, depth)`
  for `depth = N-1 … 1` (prefixes), and `rolledKey` rolls up every dimension at index
  `≥ depth`. Generalize to:
  - an **active-subset enumerator** parameterized by mode:
    - `"prefix"` → the prefixes of `by` of length `N-1 … 1` (today's behavior),
    - `"cube"` → **all** proper non-empty subsets of `by` (sizes `N-1 … 1`),
    - `"margins"` → all **size-1** subsets of `by`;
    emitted in the order defined under **Ordering** (descending size, then ascending
    active-position lexicographic);
  - a **`rolledKey` variant keyed by active set** rather than by prefix depth: a dimension
    in the active set keeps its leaf value, every other dimension takes `totalLabel`.
  Each subset then buckets leaves by their projection onto the active dims and builds
  `distribution(merged.pairs)`, exactly as the prefix code does today.
- **`leaves` / `overall` / grand total / the `tag()` collision guard are untouched.** Leaves
  are the full-set level (depth N), grand is the empty-set level (depth 0); `group()` emits
  both regardless of mode, as it does today.
- **Back-compat is structural.** For `"prefix"` the enumerator yields exactly one subset per
  depth in descending order, and the per-subset merge is unchanged, so prefix output stays
  **byte-for-byte identical**.
- **Consumers need no changes.** `selectGroups` keys off `depth`; `0 < depth < N` now
  naturally sweeps in the orthogonal margins. Shared histogram edges / KDE sample points +
  bandwidth still derive once from `gd.overall`.

## Consumers — no API change

`summarize` / `groupedHistogram` / `groupedKde` already accept
`LevelSelect { includeSubtotals?, includeOverall? }`, and those map onto CUBE with **no new
options**:

- `includeSubtotals` → any group with `0 < depth < N` — now naturally includes the
  orthogonal margins, not just the prefix ones.
- `includeOverall` → `depth === 0`.
- Plot helpers still default to **leaves only** (margins opt-in), preserving the
  no-double-counted-overlays rule.

Shared bin **edges** / sample points + bandwidth continue to derive once from `gd.overall`,
so every margin and leaf series stays aligned for overlay/facet — that already works because
margins are just more groups over the same substrate.

## What this replaces (downstream)

`rayfin-distribution-stats` currently fakes CUBE client-side in
`src/lib/analysis/build-analysis.ts` (`prepare()`): for two group columns with rollup on it
calls the grouping primitive **once per margin** —

- leaves: group by `[dim0, dim1]`
- `dim0` margin: group by `[dim0]` → tag `dim1 = (All)`
- `dim1` margin: group by `[dim1]` → tag `dim0 = (All)`
- grand: `distribution(all rows)` → `{(All), (All)}`

…then merges them into one `level`/`depth`-tagged list. That hand-rolled merge is exactly
the `rollup: "cube"` output. Landing this lets the app delete the margin-merge and call
`group(rows, { by, rollup: "cube", totalLabel: "(All)" })` +
`summarize / groupedHistogram / groupedKde` directly.

## Edge cases & decisions

1. **`2^N` explosion.** CUBE is `2^N` grouping-sets. Mitigations: `"margins"` (linear) for
   high-N; document the cost; a `groupingSets: string[][]` escape hatch is **deferred** (see
   Decisions). The explorer caps at 2 dims, so this is a docs/guard concern, not a blocker.
2. **Weight semantics on margins** — a margin aggregates the same `{value, weight}` rows
   across the rolled-up dimension; quantiles / KDE treat weights as frequencies exactly as
   leaves do. No change; confirm in docs.
3. **Empty margins** — if a margin key has zero matching leaves it simply isn't emitted (same
   as a missing leaf today); no empty `Distribution`s.
4. **N = 1** — `"prefix"` / `"margins"` / `"cube"` all yield `leaves + grand` (there is only
   one axis), so the three are indistinguishable at one dimension.
5. **Same-depth ordering** — pinned to ascending active-position lexicographic order (see
   **Ordering**) so output is deterministic and testable.

## Decisions (resolved from the draft's open questions)

1. **Ship both `"cube"` and `"margins"`** this pass. `"cube"` is the headline; `"margins"`
   is the linear-cost escape hatch. They coincide for the immediate N ≤ 2 consumer.
2. **Name the linear mode `"margins"`** (plural noun — emphasizes the set of margins it
   produces). `"marginal"` rejected.
3. **Defer the `groupingSets: string[][]` escape hatch** to a later Phase 5 slice — no
   current consumer needs arbitrary named subsets (the explorer caps at 2 dims, where
   `"cube"` / `"margins"` already cover the need).

## Testing (TDD, per repo convention)

Failing `*.spec.ts` first. Minimum coverage:

- `rollup: "cube"` on `["a","b"]` emits exactly leaves + `level:["a"]` + `level:["b"]` +
  `level:[]`, with correct `depth` and `totalLabel` tagging on rolled-up dims.
- The `level:["b"]` (orthogonal) margin is **present** — the specific gap prefix ROLLUP omits.
- Margin distributions equal the merge of their constituent leaves (weighted `n`, quantiles).
- `rollup: true` / `"prefix"` output is **byte-for-byte unchanged** (back-compat guard).
- `"margins" === "cube"` for N ≤ 2; they differ for N = 3 (`"cube"` adds the depth-2 faces,
  `"margins"` does not).
- **Same-depth emit order is deterministic** and follows the ascending active-position rule
  (e.g. `["a"]` before `["b"]` at depth 1; `[a,b]`,`[a,c]`,`[b,c]` at depth 2 for N = 3).
- **N = 1 collapse**: `"cube"` / `"margins"` / `"prefix"` all produce `leaves + grand`.
- `summarize` with `includeSubtotals` surfaces the new margins; plot helpers still default to
  leaves only.
