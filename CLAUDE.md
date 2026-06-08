# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`distribu-tron` is a zero-runtime-dependency, ESM-only TypeScript library for **weighted /
pre-aggregated distribution statistics** — quantiles, descriptives, histogram, KDE, ECDF, box plot, and
grouped/ROLLUP variants — computed directly from a frequency table (`{ value, weight }[]`) rather than a raw
sample array. It is published to npm as a specialized tool for already-aggregated data, not a general-purpose
stats library (see the README's "Performance — and when not to use this").

## Repo layout (pnpm monorepo)

The publishable package lives at **`packages/distribu-tron/`** — that's where nearly all work happens.
Root holds the workspace (`pnpm-workspace.yaml`), `docs/`, and a reserved `playground/`. Root `package.json`
scripts just delegate to the package via `pnpm -C packages/distribu-tron …`.

> The interactive shell's working directory tends to reset to the repo root between turns. Either `cd
> packages/distribu-tron` first, or use the root delegating scripts. `pnpm -C <dir> <script>` sometimes
> fails in this environment — prefer `cd packages/distribu-tron && pnpm <script>`.

## Commands (run from `packages/distribu-tron/`)

- **Test (all):** `pnpm vitest run` — tests are `src/**/*.spec.ts`, colocated next to source.
- **Test (one file):** `pnpm vitest run src/quantiles.spec.ts`
- **Typecheck:** `pnpm tsc --noEmit`
- **Lint + format check (one gate):** `pnpm lint` (= `biome check .`)
- **Apply formatting + safe fixes:** `pnpm format` (= `biome check --write .`)
- **Build:** `pnpm build` (tsup → ESM `dist/index.js` + `dist/index.d.ts`)
- **Benchmarks:** `pnpm bench` (= `vitest bench --run`; `bench/*.bench.ts`, comparison only — no asserts)

CI (`.github/workflows/ci.yml`) and the release workflow both run lint → typecheck → test → build. Keep all
four green.

## Architecture: the prepared-substrate model

The whole library is organized around one idea — **prepare once, read many times.** Understanding this
makes everything else fall into place:

1. **`src/distribution.ts`** — the `distribution()` factory normalizes any supported input
   (`WeightedValue[]` | `number[]` | columnar `{ values, weights? }`) into an immutable `Distribution`: a
   sorted, **distinct** `Float64Array` substrate (`values`, `weights`, and an inclusive `cumulative` weight
   array) plus `size` (distinct count), `n` (**total weight = Σ weight**), `min`, `max`. It validates,
   deduplicates, and sorts (unless `{ sorted: true }`).

2. **Free functions read that substrate.** `descriptives.ts`, `quantiles.ts`, `histogram.ts`, `kde.ts`,
   `ecdf.ts`, `boxplot.ts`, `summary.ts` are tree-shakeable functions that take a `Distribution` and compute
   results via binary search over `cumulative` (weighted quantile rank) or scans over `values`/`weights`.
   They never re-sort or re-aggregate.

3. **`src/group.ts`** — the grouping layer. `group(rows, spec)` buckets rows into one `Distribution` per key
   with optional prefix-ROLLUP subtotals + grand total (tagged by `level`/`depth`). `summarize` /
   `groupedHistogram` / `groupedKde` are consumers that compute a **shared domain** (identical histogram
   edges / KDE sample points + one bandwidth, derived from the overall distribution) so series overlay
   cleanly.

4. **`src/internal/`** — shared primitives not in the public API: `sum.ts` (Neumaier compensated summation,
   used for all moments), `ticks.ts` (vendored d3 tick/nice), `silverman.ts` (Silverman bandwidth + the
   distribution-derived `silvermanFor`).

`src/index.ts` is the public barrel; `src/types.ts` holds all public types.

## Conventions and invariants (non-obvious; respect these)

- **The field is `weight`, never `count`** (fractional weights allowed). `n` is Σ weight, not a row count.
- **Numerical stability is a feature.** Use `neumaierSum`/`neumaierSumMap` from `internal/sum.ts` for any
  summation/moment — naive accumulation drifts at large `n` and there are tests asserting the stable result.
- **Don't re-duplicate the Silverman formula.** It lives once in `internal/silverman.ts` and is used by both
  `kde.ts` and `group.ts`. It previously existed in two copies and silently drifted (a real bug). Likewise,
  the weighted-IQR/stdev for the FD histogram rule and KDE bandwidth route through the canonical
  `quantile()`/`stdev()` — keep them consistent, don't fork local copies.
- **`internal/ticks.ts` is vendored from d3-array (ISC).** Keep it verbatim — don't refactor its complexity
  or strip the attribution header. The `LICENSE` and README carry the ISC notice.
- **Degenerate-input contracts are uniform and tested:** an empty *or zero-mass* (`n <= 0`) distribution
  makes scalar functions return `NaN` (with `min` `+Infinity`, `max` `-Infinity`) and array functions return
  `[]`; KDE returns `[]` when the bandwidth resolves to ≤ 0 (incl. single-value). Malformed input throws
  `RangeError` (non-finite value, negative/non-finite weight, mismatched columnar lengths, `p ∉ [0,1]`
  incl. `NaN`). Match these when adding functions.
- **`distribution(input, { sorted: true })`** is a trust-the-caller fast path that skips aggregation/sort
  and does **not** validate ascending/distinct order — by design. Used for SQL `GROUP BY value ORDER BY
  value` output.
- **Grouped output flattens the group key onto each row**, so a grouping dimension named after an output
  field (`weight`, `x`, `n`, `depth`, …) throws (`tag()` guards this). Don't reintroduce silent overwrite.
- **TDD is the workflow** for behavioral changes: failing `*.spec.ts` first → run-to-fail → implement →
  run-to-pass. The plan in `docs/plans/` was executed this way.

## Tooling specifics

- **Biome** is the linter + formatter (`biome.json`): 120 line width, double quotes, semicolons, 2-space.
  Two rules are intentionally **off**: `noNonNullAssertion` (the codebase uses `!` on typed-array indexing
  under `noUncheckedIndexedAccess` — this is the deliberate idiom) and `useExponentiationOperator` (`Math.pow`
  is kept, partly for consistency with vendored `ticks.ts`).
- **tsup** builds ESM-only with a banner carrying the MIT + d3/ISC notice. `package.json` `files: ["dist"]`.
- Node ≥ 22 (developed on 24), pnpm.

## Docs

- **Edit the root `README.md` only.** A `prepack` hook copies it into the package at pack/publish time;
  `packages/distribu-tron/README.md` is a generated copy — don't hand-edit it.
- `docs/solutions/` is a searchable knowledge store of documented learnings (bugs, best practices,
  patterns), organized by category with YAML frontmatter — relevant when working in a documented area.
- `docs/designs/` and `docs/plans/` hold the design spec and the task-by-task build plan.

## Conventions for changes

- Source files need **no license banner** (MIT OSS package) — except `internal/ticks.ts`, which keeps its
  ISC attribution.
- Commits use **conventional-commit** format. Commit/publish only when asked.

## Releasing (npm publish)

Publishing is **tag-triggered**: pushing a `v*` tag runs `.github/workflows/release.yml`, which gates on
lint → typecheck → test → build, then `pnpm publish` with provenance. The published **version is whatever
is in `packages/distribu-tron/package.json`** — the tag only triggers the run, so keep the two in sync.

The workflow derives the npm **dist-tag** from the version: a prerelease (`0.1.0-beta.0`) publishes under its
label (`beta`); a stable version (`0.1.0`) publishes under `latest`. So `npm i distribu-tron@beta` pulls
prereleases, while `npm i distribu-tron` only resolves once a stable version exists.

To cut a release:

1. Set the version in `packages/distribu-tron/package.json` (e.g. `0.1.0-beta.1`, or `0.1.0` for stable).
2. Commit, merge to `main`, and confirm **CI is green on `main`** (a red tag = a failed publish).
3. Tag and push: `git tag v0.1.0-beta.1 && git push origin v0.1.0-beta.1`.
4. Verify: `npm view distribu-tron dist-tags`.

One-time requirements: the GitHub repo must be **public** (provenance needs a public repo + the OIDC
`id-token: write` the workflow already requests), and an Actions secret **`NPM_TOKEN`** must hold an npm
**granular access token** with **read & write** (publish) permission for the package. pnpm is pinned via the
root `packageManager` field so CI matches local.
