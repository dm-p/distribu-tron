# Distribution API naming cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename two underperforming public `Distribution` fields pre-publish — `size → distinctCount` and `cumulative → cumulativeWeights` — with zero semantic change.

**Architecture:** Pure mechanical rename. The TypeScript compiler is the safety net: renaming a field on the `Distribution` interface turns `tsc --noEmit` red at every call site, which enumerates the work; the rename is complete when typecheck **and** the full existing `vitest` suite go green with no assertion's *meaning* changed. No new tests are written (TDD does not apply to a behavior-preserving rename with full coverage).

**Tech Stack:** TypeScript (ESM), Vitest, Biome, tsup. All commands run from `packages/distribu-tron/`.

**Design source:** [docs/designs/2026-06-10-distribution-api-naming-design.md](../designs/2026-06-10-distribution-api-naming-design.md)

---

## ⚠️ Environment note: commit signing

This repo signs commits (`commit.gpgsign=true`), and in the agent environment `gpg`
has **no secret key** for the configured signing key — `git commit` fails with
`No secret key`. Each task below ends in a commit. Run those commits **where your
GPG key is available** (your own terminal), or fix the agent's gpg-agent/key first.
Do **not** add `--no-gpg-sign` unless the user explicitly approves it. If running
the plan inline cannot sign, complete the edits and let the user run the commits.

## File structure (what gets touched)

No files are created or deleted (except this plan / the already-moved design doc).
Every change is an in-place rename:

- **Public types:** `src/types.ts` — `Distribution` + `SummaryStatistics`.
- **Object construction:** `src/distribution.ts` — local vars feed the renamed fields.
- **Substrate readers:** `src/descriptives.ts`, `src/quantiles.ts`, `src/histogram.ts`,
  `src/kde.ts`, `src/ecdf.ts`, `src/boxplot.ts`, `src/summary.ts`, `src/internal/silverman.ts`.
- **Tests:** `src/distribution.spec.ts`, `src/summary.spec.ts`, `src/kde.spec.ts`,
  `src/group.spec.ts`, `src/descriptives.spec.ts` (comment only).
- **Docs:** root `README.md`.

**Critical distinction — do NOT rename these** (they are local variables / helper
parameters that merely *share* the name, not the public field):

- `src/descriptives.ts` — `weightedMedianSorted(values, cumulative, n)`: the
  `cumulative` **parameter** (declared line ~47, used ~51) and the local `size`
  (lines ~48–52) stay as-is. Only the **caller** at line ~64 passes `d.cumulative`,
  which becomes `d.cumulativeWeights`.
- Replace the exact strings `d.size` and `d.cumulative`. Bare `size` / `cumulative`
  identifiers are renamed only in `src/distribution.ts` (Task 1 Step 3 / Task 2 Step 2),
  where they directly feed the public field.

---

## Task 1: Rename `size` → `distinctCount`

**Files:**
- Modify: `src/types.ts` (interface `Distribution`, interface `SummaryStatistics`)
- Modify: `src/distribution.ts` (local var + field key)
- Modify: `src/summary.ts` (field key + read)
- Modify: `src/descriptives.ts`, `src/quantiles.ts`, `src/histogram.ts`, `src/kde.ts`,
  `src/ecdf.ts`, `src/boxplot.ts`, `src/internal/silverman.ts` (all read `d.size`)
- Test: `src/distribution.spec.ts`, `src/summary.spec.ts`, `src/kde.spec.ts`

- [ ] **Step 1: Rename the field on both public interfaces**

In `src/types.ts`, change the `Distribution` field (line ~21):

```ts
// before
  readonly size: number;
// after
  readonly distinctCount: number; // count of DISTINCT values
```

And the `SummaryStatistics` field (line ~35):

```ts
// before
  size: number;
// after
  distinctCount: number;
```

- [ ] **Step 2: Run typecheck to confirm it goes RED (this enumerates the call sites)**

Run: `cd packages/distribu-tron && pnpm tsc --noEmit`
Expected: FAIL — errors of the form `Property 'size' does not exist on type 'Distribution'`
(and `'SummaryStatistics'`) at every reader in `boxplot.ts`, `descriptives.ts`,
`ecdf.ts`, `histogram.ts`, `kde.ts`, `quantiles.ts`, `internal/silverman.ts`,
`summary.ts`, `distribution.ts`, and the `.spec.ts` files. This error list **is**
your checklist for Step 3–4.

- [ ] **Step 3: Update `src/distribution.ts` (local var + field key)**

Rename the local `size` (it feeds `distinctCount`, `min`, `max`, and the array length):

```ts
// before (lines ~85–101)
  const size = values.length;
  const cumulative = new Float64Array(size);
  let running = 0;
  for (let i = 0; i < size; i++) {
    running += weights[i]!;
    cumulative[i] = running;
  }
  // ...
  return {
    size,
    n: running,
    min: size ? values[0]! : Infinity,
    max: size ? values[size - 1]! : -Infinity,
// after
  const distinctCount = values.length;
  const cumulative = new Float64Array(distinctCount);
  let running = 0;
  for (let i = 0; i < distinctCount; i++) {
    running += weights[i]!;
    cumulative[i] = running;
  }
  // ...
  return {
    distinctCount,
    n: running,
    min: distinctCount ? values[0]! : Infinity,
    max: distinctCount ? values[distinctCount - 1]! : -Infinity,
```

(Leave `cumulative` untouched here — that is Task 2.)

- [ ] **Step 4: Update every `d.size` reader and the summary mapping**

In each of these files, replace **all** occurrences of the exact string `d.size`
with `d.distinctCount` (this does NOT touch the bare local `size` in
`descriptives.ts`'s `weightedMedianSorted`):

- `src/boxplot.ts` (1: line ~13)
- `src/descriptives.ts` (lines ~6, 20, 24, 28, 56, 58, 63, 68, 81, 90)
- `src/ecdf.ts` (lines ~5, 6, 7)
- `src/histogram.ts` (lines ~24, 59, 60, 77)
- `src/kde.ts` (lines ~22, 72, 82)
- `src/quantiles.ts` (lines ~6, 12, 36, 37, 74, 76)
- `src/internal/silverman.ts` (lines ~23, 39)

In `src/summary.ts`, change both sides of line ~9:

```ts
// before
    size: d.size,
// after
    distinctCount: d.distinctCount,
```

- [ ] **Step 5: Update the tests that read `.size`**

Replace `d.size` → `d.distinctCount` / `s.size` → `s.distinctCount`:

- `src/distribution.spec.ts` line ~15: `expect(d.size).toBe(3);` → `expect(d.distinctCount).toBe(3);`
- `src/distribution.spec.ts` line ~71: `expect(d.size).toBe(0);` → `expect(d.distinctCount).toBe(0);`
- `src/summary.spec.ts` line ~9: `expect(s.size).toBe(5);` → `expect(s.distinctCount).toBe(5);`
- `src/kde.spec.ts` line ~19: `for (let i = 0; i < d.size; i++) {` → `for (let i = 0; i < d.distinctCount; i++) {`

The asserted **values** (3, 0, 5) must not change — only the property name.

- [ ] **Step 6: Run typecheck to confirm GREEN**

Run: `cd packages/distribu-tron && pnpm tsc --noEmit`
Expected: PASS (no output, exit 0). If any `size` error remains, it points at a
missed reader — fix it.

- [ ] **Step 7: Run the full suite to confirm GREEN**

Run: `cd packages/distribu-tron && pnpm vitest run`
Expected: PASS — every test green. No test should have been made to pass by changing
what it asserts; only field names changed.

- [ ] **Step 8: Lint**

Run: `cd packages/distribu-tron && pnpm lint`
Expected: PASS (`biome check .` clean).

- [ ] **Step 9: Commit** (see ⚠️ signing note above)

```bash
git add packages/distribu-tron/src
git commit -m "refactor(distribution)!: rename size -> distinctCount

Pre-publish clarity rename of the distinct-value-count field on Distribution
and SummaryStatistics. No behavioral change."
```

---

## Task 2: Rename `cumulative` → `cumulativeWeights`

**Files:**
- Modify: `src/types.ts` (interface `Distribution`)
- Modify: `src/distribution.ts` (local var + field key)
- Modify: `src/descriptives.ts` (caller at line ~64; **not** the helper param), `src/quantiles.ts`, `src/ecdf.ts`
- Test: `src/distribution.spec.ts`, `src/group.spec.ts`

- [ ] **Step 1: Rename the field on the `Distribution` interface**

In `src/types.ts` (line ~27):

```ts
// before
  readonly cumulative: Float64Array; // running Σ weight; cumulative[i] = Σ_{j<=i} weights[j]
// after
  readonly cumulativeWeights: Float64Array; // inclusive running Σ weight; cumulativeWeights[i] = Σ_{j<=i} weights[j]
```

- [ ] **Step 2: Update `src/distribution.ts` (rename the local var so the shorthand field key follows)**

```ts
// before (lines ~86, 90, 104)
  const cumulative = new Float64Array(distinctCount);
  // ...
    cumulative[i] = running;
  // ...
    cumulative,
// after
  const cumulativeWeights = new Float64Array(distinctCount);
  // ...
    cumulativeWeights[i] = running;
  // ...
    cumulativeWeights,
```

- [ ] **Step 3: Run typecheck to confirm it goes RED**

Run: `cd packages/distribu-tron && pnpm tsc --noEmit`
Expected: FAIL — `Property 'cumulative' does not exist on type 'Distribution'` at the
readers in `descriptives.ts`, `quantiles.ts`, `ecdf.ts`, and the `.spec.ts` files.

- [ ] **Step 4: Update every `d.cumulative` reader**

Replace the exact string `d.cumulative` with `d.cumulativeWeights`:

- `src/descriptives.ts` line ~64:
  `weightedMedianSorted(d.values, d.cumulative, d.n)` →
  `weightedMedianSorted(d.values, d.cumulativeWeights, d.n)`.
  **Leave the helper's `cumulative` parameter (line ~47) and its body usage (line ~51)
  unchanged** — it is an internal parameter, not the public field. Optionally update
  the explanatory comment at line ~66 (`reuse d.cumulative`) to `d.cumulativeWeights`
  for accuracy.
- `src/quantiles.ts` line ~9: `if (d.cumulative[mid]! <= r)` → `if (d.cumulativeWeights[mid]! <= r)`
- `src/quantiles.ts` line ~82: `const cum = lo === 0 ? 0 : d.cumulative[lo - 1]!;` → `... d.cumulativeWeights[lo - 1]!;`
- `src/ecdf.ts` line ~7: `out[i] = { x: d.values[i]!, p: d.cumulative[i]! / d.n };` → `... p: d.cumulativeWeights[i]! / d.n };`

- [ ] **Step 5: Update the tests that read `.cumulative`**

- `src/distribution.spec.ts` line ~13: `expect(Array.from(d.cumulative)).toEqual([2, 7, 8]);` → `Array.from(d.cumulativeWeights)`
- `src/distribution.spec.ts` line ~66: `expect(Array.from(d.cumulative)).toEqual([0, 5]);` → `Array.from(d.cumulativeWeights)`
- `src/group.spec.ts` line ~81: `expect(Array.from(subA.distribution.cumulative)).toEqual([1, 2, 3]);` → `subA.distribution.cumulativeWeights`

The asserted arrays must not change — only the property name.

- [ ] **Step 6: Run typecheck to confirm GREEN**

Run: `cd packages/distribu-tron && pnpm tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 7: Run the full suite to confirm GREEN**

Run: `cd packages/distribu-tron && pnpm vitest run`
Expected: PASS — all tests green, asserted values unchanged.

- [ ] **Step 8: Lint**

Run: `cd packages/distribu-tron && pnpm lint`
Expected: PASS.

- [ ] **Step 9: Commit** (see ⚠️ signing note)

```bash
git add packages/distribu-tron/src
git commit -m "refactor(distribution)!: rename cumulative -> cumulativeWeights

Pre-publish clarity rename of the inclusive running-weight substrate array on
Distribution. No behavioral change."
```

---

## Task 3: Update documentation

**Files:**
- Modify: root `README.md` (edit the **root** README only — the package copy is
  generated by the `prepack` hook)

- [ ] **Step 1: Update the `Distribution` field description**

In root `README.md` (around lines 63–64):

```md
<!-- before -->
`Distribution` exposes `size` (distinct count), `n` (total weight, **Σ weight**), `min`, `max`,
and the read-only `values` / `weights` / `cumulative` arrays.
<!-- after -->
`Distribution` exposes `distinctCount` (count of distinct values), `n` (total weight, **Σ weight**), `min`, `max`,
and the read-only `values` / `weights` / `cumulativeWeights` arrays.
```

- [ ] **Step 2: Confirm no other README references to the old names**

Run (from repo root): `rg -n "\bsize\b|\bcumulative\b" README.md`
Expected: only prose hits that legitimately mean the English words
(e.g. "working set", "cumulative weights" as a phrase) — no remaining references to a
field literally named `size` or `cumulative`. Update any that slipped through.

- [ ] **Step 3: Build to confirm the package still emits cleanly**

Run: `cd packages/distribu-tron && pnpm build`
Expected: PASS — tsup writes `dist/index.js` + `dist/index.d.ts`; the emitted `.d.ts`
shows `distinctCount` and `cumulativeWeights` on `Distribution`.

- [ ] **Step 4: Commit** (see ⚠️ signing note)

```bash
git add README.md
git commit -m "docs: reflect distinctCount / cumulativeWeights rename in README"
```

---

## Final verification gate

After all three tasks, from `packages/distribu-tron/`, confirm the four-green CI gate:

- [ ] `pnpm lint` — PASS
- [ ] `pnpm tsc --noEmit` — PASS
- [ ] `pnpm vitest run` — PASS (no assertion meaning changed)
- [ ] `pnpm build` — PASS

The rename is correct only if all four are green **and** no test was made to pass by
weakening or re-meaning an assertion. Also confirm the design doc
[docs/designs/2026-06-10-distribution-api-naming-design.md](../designs/2026-06-10-distribution-api-naming-design.md)
is committed (it was moved here from the brainstorming step and may still be untracked).
