# Distribution API naming cleanup

**Date:** 2026-06-10
**Branch:** `refactor/distribution-surface-audit`
**Status:** Approved design, pre-implementation

## Problem

`distribu-tron` is not yet published, so the public `Distribution` shape can still
change without a breaking-change cost. Two field names on that shape underperform:

- **`size`** means "count of *distinct* values" — but the documentation has to
  explicitly state "this is distinct count, **not** total weight." When a field
  needs a footnote to disambiguate it from a sibling field, the name is doing too
  little work. `size` collides with two intuitions at once: JS readers expect
  `Set.size`/`Map.size` (number of entries) and statisticians expect "size" ≈
  sample size (which here is actually `n`).
- **`cumulative`** leaves "cumulative *of what?*" implicit. It is the inclusive
  running Σ weight, parallel to `weights`, but the name does not say so.

## Decision

A pure, pre-publish **rename** with **no semantic or behavioral change**:

| Old field | New field | Interfaces affected |
| --- | --- | --- |
| `size` | `distinctCount` | `Distribution`, `SummaryStatistics` |
| `cumulative` | `cumulativeWeights` | `Distribution` |

### Why these names

- **`distinctCount`** — maximally unambiguous. Mirrors SQL `COUNT(DISTINCT …)`,
  cannot be misread as a boolean (the trap with a bare `distinct`) or as total
  weight. The mild verbosity next to the terse `n` is acceptable because the field
  is rarely read by end users (it is mostly an internal loop bound); clarity wins
  over brevity at the few public call sites.
- **`cumulativeWeights`** — self-documenting and parallel to `weights`, removing
  the "cumulative of what" question. It is primarily an internal binary-search
  substrate, so the extra length costs little.

### Deliberately kept

- **`n`** = Σ weight = the **effective sample size**. This is an intentional
  generalization of the statistician's `n` to the weighted/fractional case, and
  the README leans into it (quantiles treat `Σweight` as the type-7 sample size).
  Renaming to `totalWeight` would lose that resonance and the quantile-rank story.
  The `n`-vs-distinct-count tension is resolved by the `size → distinctCount`
  rename, not by touching `n`.
- **`min`, `max`, `values`, `weights`, `timings`** — already unambiguous.

## Scope / blast radius

All changes are mechanical renames. The existing test suite is the safety net.

**Public types** (`src/types.ts`):

- `Distribution.size` → `distinctCount`
- `Distribution.cumulative` → `cumulativeWeights`
- `SummaryStatistics.size` → `distinctCount`

**Internal readers of `d.size`** → `d.distinctCount`:
`boxplot.ts`, `descriptives.ts`, `ecdf.ts`, `histogram.ts`, `kde.ts`,
`quantiles.ts`, `internal/silverman.ts`, `summary.ts`.

**Internal readers of `d.cumulative`** → `d.cumulativeWeights`:
`distribution.ts` (construction), `ecdf.ts`, and the quantile binary search.

**Local variables** named `size` (e.g. `distribution.ts`, `descriptives.ts`)
are **not** the public field. They may remain, but should be aligned to
`distinctCount` where they directly feed the renamed field, for readability.
The `weightedQuantileScan` local `cumulative` parameter is internal and may keep
its short name, or align — implementer's discretion, kept consistent within a file.

**Tests:** `distribution.spec.ts`, `summary.spec.ts`, `kde.spec.ts` reference
`.size`; update the references (assertions' *meaning* must not change — a changed
assertion meaning is a bug, not a rename).

**Docs:**

- Root `README.md` (the `size (distinct count)` / `values / weights / cumulative`
  lines around 63–64). Edit the **root** README only (the package copy is generated
  by the `prepack` hook).
- The `Distribution` interface documentation added on the documentation branch
  (the `### The Distribution object` block), if/when it merges here.

## Testing & verification

This is a mechanical rename over code with full existing coverage, so **no new
tests are written** (TDD does not apply). The verification gate is the standard
four-green check, run from `packages/distribu-tron/`:

1. `pnpm tsc --noEmit` — typecheck (catches any missed reference).
2. `pnpm lint` — Biome check.
3. `pnpm vitest run` — full suite green, with **no assertion meaning changed**.
4. `pnpm build` — tsup ESM + d.ts build succeeds.

The rename is correct only if all four stay green *and* no test was made to pass
by weakening or re-meaning an assertion.

## Out of scope

- Any change to `n`, `min`, `max`, `values`, `weights`, `timings`.
- Any behavioral, numerical, or API-surface change beyond the two field renames.
- Renaming grouping-layer fields (`level`, `depth`, `key`, etc.) — not part of this
  audit.
