import type {
  Accessor,
  Bin,
  Distribution,
  DistributionGroup,
  GroupSpec,
  GroupedDistribution,
  GroupKeyValue,
  HistogramOptions,
  KdeOptions,
  KdePoint,
  LevelSelect,
  SummaryStatistics,
  WeightedValue,
} from "./types";
import { distribution } from "./distribution";
import { histogram } from "./histogram";
import { kde } from "./kde";
import { summary } from "./summary";
import { resolveBandwidth } from "./internal/silverman";

function acc<T>(a: Accessor<T>): (row: Record<string, unknown>) => T {
  return typeof a === "function" ? a : (row) => row[a] as T;
}

/** Internal resolved form of the public `rollup` slot. */
type RollupMode = "prefix" | "margins" | "cube";

/** k-combinations of indices [0, n) in lexicographic ascending order, e.g. (3, 2) → [0,1] [0,2] [1,2]. */
function* combinations(n: number, k: number): Generator<number[]> {
  const combo = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield combo.slice();
    let i = k - 1;
    while (i >= 0 && combo[i]! === n - k + i) i--;
    if (i < 0) return;
    combo[i] = combo[i]! + 1;
    for (let j = i + 1; j < k; j++) combo[j] = combo[j - 1]! + 1;
  }
}

/**
 * Active-dimension index subsets to emit as subtotals — i.e. the proper non-empty subsets of `[0, n)`
 * the mode calls for (leaves = the full set and the grand total = the empty set are emitted separately).
 * Emit order: descending size (depth), then ascending lexicographic within a size.
 *   - "prefix"  → one subset per size: the prefix [0 … size-1]  (today's hierarchical ROLLUP)
 *   - "cube"    → every subset of each size                     (full CUBE)
 *   - "margins" → only the size-1 subsets                       (each single-dimension margin)
 */
function subtotalSubsets(n: number, mode: RollupMode): number[][] {
  const subsets: number[][] = [];
  for (let size = n - 1; size >= 1; size--) {
    if (mode === "margins" && size !== 1) continue;
    if (mode === "prefix") {
      subsets.push(Array.from({ length: size }, (_, i) => i));
    } else {
      for (const combo of combinations(n, size)) subsets.push(combo);
    }
  }
  return subsets;
}

/** Resolve the public `rollup` slot to an internal mode. `true` is the back-compat alias for "prefix";
 *  `false` / `undefined` mean no rollup (leaves only). */
function resolveRollupMode(rollup: GroupSpec["rollup"]): RollupMode | null {
  if (rollup === true || rollup === "prefix") return "prefix";
  if (rollup === "margins") return "margins";
  if (rollup === "cube") return "cube";
  return null;
}

type Bucket = { key: Record<string, GroupKeyValue>; pairs: WeightedValue[] };

/** Get-or-create the bucket whose id is `key` projected onto `idDims`, then append `pairs` to it. */
function bucketPush(
  buckets: Map<string, Bucket>,
  idDims: string[],
  key: Record<string, GroupKeyValue>,
  pairs: WeightedValue[],
): void {
  const id = JSON.stringify(idDims.map((d) => key[d]));
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { key, pairs: [] };
    buckets.set(id, bucket);
  }
  for (const p of pairs) bucket.pairs.push(p);
}

/** Bucket rows into leaf groups keyed by the full dimension tuple, collecting every pair for `overall`. */
function bucketLeaves(
  rows: ReadonlyArray<Record<string, unknown>>,
  dimensions: string[],
  getValue: (row: Record<string, unknown>) => number,
  getWeight: (row: Record<string, unknown>) => number,
): { leafBuckets: Map<string, Bucket>; allPairs: WeightedValue[] } {
  const leafBuckets = new Map<string, Bucket>();
  const allPairs: WeightedValue[] = [];
  for (const row of rows) {
    const key: Record<string, GroupKeyValue> = {};
    for (const dim of dimensions) key[dim] = row[dim] as GroupKeyValue;
    const pair = { value: getValue(row), weight: getWeight(row) };
    bucketPush(leafBuckets, dimensions, key, [pair]);
    allPairs.push(pair);
  }
  return { leafBuckets, allPairs };
}

/** A leaf key with every dimension NOT in the active index set replaced by the rollup total label. */
function rolledKey(
  dimensions: string[],
  leafKey: Record<string, GroupKeyValue>,
  active: Set<number>,
  totalLabel: GroupKeyValue,
): Record<string, GroupKeyValue> {
  const key: Record<string, GroupKeyValue> = {};
  for (let i = 0; i < dimensions.length; i++) {
    const d = dimensions[i]!;
    key[d] = active.has(i) ? leafKey[d]! : totalLabel;
  }
  return key;
}

/**
 * Subtotals for the chosen mode. For each active-dimension subset (see {@link subtotalSubsets}), merge the
 * leaves that share its active-dimension key — no row re-scan. Prefix ROLLUP is the special case where the
 * active subset is always a prefix of `by`, so this stays byte-for-byte identical for `mode === "prefix"`.
 */
function rollupSubtotals(
  leafBuckets: Map<string, Bucket>,
  dimensions: string[],
  totalLabel: GroupKeyValue,
  mode: RollupMode,
): DistributionGroup[] {
  const subtotals: DistributionGroup[] = [];
  for (const activeIdx of subtotalSubsets(dimensions.length, mode)) {
    const activeDims = activeIdx.map((i) => dimensions[i]!);
    const active = new Set(activeIdx);
    const buckets = new Map<string, Bucket>();
    for (const leaf of leafBuckets.values()) {
      // A subtotal merges pairs from several leaves (group-insertion order, not value order), so it must
      // always sort/aggregate — never trust spec.sorted here.
      bucketPush(buckets, activeDims, rolledKey(dimensions, leaf.key, active, totalLabel), leaf.pairs);
    }
    for (const b of buckets.values()) {
      subtotals.push({ key: b.key, level: activeDims, depth: activeIdx.length, distribution: distribution(b.pairs) });
    }
  }
  return subtotals;
}

/**
 * Group rows into per-key {@link Distribution}s. Returns the leaf groups, the `overall` distribution,
 * and (with `rollup`) subtotals + a grand total tagged by `level`/`depth` — prefix ROLLUP (`true`/"prefix"),
 * every single-dimension margin ("margins"), or all grouping-sets ("cube").
 * Rolled-up dimensions take `spec.totalLabel`, which **defaults to `null`** — consumers filtering by
 * key equality must handle `null` (or pass an explicit label like `"(All)"`).
 */
export function group(rows: ReadonlyArray<Record<string, unknown>>, spec: GroupSpec): GroupedDistribution {
  const dimensions = Array.isArray(spec.by) ? spec.by : [spec.by];
  const totalLabel = spec.totalLabel ?? null;
  const sorted = spec.sorted;
  const getValue = acc<number>(spec.value);
  const getWeight = spec.weight ? acc<number>(spec.weight) : () => 1;

  const { leafBuckets, allPairs } = bucketLeaves(rows, dimensions, getValue, getWeight);
  // `spec.sorted` only applies per-leaf (a single group's rows may arrive value-sorted). `allPairs` and
  // rollup buckets concatenate across groups, so they are never globally sorted — those always re-sort.
  const leaves: DistributionGroup[] = Array.from(leafBuckets.values(), (b) => ({
    key: b.key,
    level: [...dimensions],
    depth: dimensions.length,
    distribution: distribution(b.pairs, { sorted }),
  }));
  const overall = distribution(allPairs);

  const mode = resolveRollupMode(spec.rollup);
  if (!mode) return { dimensions, groups: leaves, leaves, overall };

  const grandKey: Record<string, GroupKeyValue> = {};
  for (const dim of dimensions) grandKey[dim] = totalLabel;
  const grand: DistributionGroup = { key: grandKey, level: [], depth: 0, distribution: overall };
  const groups = [...leaves, ...rollupSubtotals(leafBuckets, dimensions, totalLabel, mode), grand];
  return { dimensions, groups, leaves, overall };
}

// ─── grouped consumers ───────────────────────────────────────────────────────

/**
 * A consumer output row flattened with its group's key fields and `depth`.
 *
 * ⚠️ Reserved field names: the group key is spread AFTER the payload, so a dimension whose name
 * collides with an output field (e.g. grouping by a column literally named `weight`, `x`, `density`,
 * `n`, `min`, `max`, `median`, or `depth`) will OVERWRITE that statistic/bin field with the key value.
 * Don't name grouping dimensions after the output fields of the consumer you feed them into.
 */
type Tagged<T> = T & Record<string, GroupKeyValue> & { depth: number };

function selectGroups(gd: GroupedDistribution, sel: LevelSelect): DistributionGroup[] {
  const leafDepth = gd.dimensions.length;
  return gd.groups.filter(
    (g) =>
      g.depth === leafDepth ||
      (sel.includeSubtotals && g.depth > 0 && g.depth < leafDepth) ||
      (sel.includeOverall && g.depth === 0),
  );
}

function tag<T extends object>(g: DistributionGroup, row: T): Tagged<T> {
  // Fail fast on the reserved-field-name collision (see {@link Tagged}): a dimension named after an
  // output field would silently overwrite that statistic/bin value. Throw instead of corrupting.
  for (const k of Object.keys(g.key)) {
    if (k === "depth" || Object.hasOwn(row, k)) {
      throw new RangeError(
        `grouping dimension "${k}" collides with a reserved output field ("depth" or a statistic/bin field); rename the dimension.`,
      );
    }
  }
  return { ...row, ...g.key, depth: g.depth } as Tagged<T>;
}

/**
 * Per-group summary statistics, one tagged row per selected level. Unlike `groupedHistogram`/
 * `groupedKde` (leaves only by default), tables want every level, so this DEFAULTS to including
 * subtotals and the grand total — pass `{ includeSubtotals: false }` / `{ includeOverall: false }`
 * to suppress. With no `rollup`, those levels don't exist, so the result is just the leaves.
 * See {@link Tagged} for the reserved-field-name caveat.
 */
export function summarize(
  gd: GroupedDistribution,
  opts: LevelSelect = { includeSubtotals: true, includeOverall: true },
): Tagged<SummaryStatistics>[] {
  const groups = selectGroups(gd, {
    includeSubtotals: opts.includeSubtotals !== false,
    includeOverall: opts.includeOverall !== false,
  });
  return groups.map((g) => tag(g, summary(g.distribution)));
}

/**
 * One histogram per selected group, all sharing identical bin edges derived from the overall
 * distribution (so series are directly comparable / stackable). Leaves only by default; opt into
 * subtotals/overall via {@link LevelSelect}. See {@link Tagged} for the reserved-field-name caveat.
 */
export function groupedHistogram(gd: GroupedDistribution, opts: HistogramOptions & LevelSelect = {}): Tagged<Bin>[] {
  // Shared edges from the overall rollup, reused for every selected group.
  const template = histogram(gd.overall, opts);
  const edges = edgesOf(template);
  const out: Tagged<Bin>[] = [];
  for (const g of selectGroups(gd, opts)) {
    for (const bin of histogram(g.distribution, { edges })) out.push(tag(g, bin));
  }
  return out;
}

/**
 * One KDE curve per selected group, all sharing identical sample points and a single bandwidth
 * (derived once from the overall distribution unless a numeric `bandwidth` is given) so the curves
 * are comparable. Leaves only by default. See {@link Tagged} for the reserved-field-name caveat.
 *
 * `clamp` applies to the SHARED grid: it restricts the common sample points to the overall
 * distribution's `[min, max]`. Per-group curves are intentionally NOT clamped to each group's own
 * domain — they all share one x-axis, which is the point of a grouped KDE.
 */
export function groupedKde(gd: GroupedDistribution, opts: KdeOptions & LevelSelect = {}): Tagged<KdePoint>[] {
  // Shared sample points + bandwidth from the overall rollup.
  // The grid is derived kernel-independently (no kernel option) so compact-support kernels like
  // Epanechnikov do not produce a narrower grid than Gaussian (trimZeroTails is kernel-sensitive).
  const { kernel: _kernel, ...gridOpts } = opts;
  const template = kde(gd.overall, gridOpts);
  const samplePoints = template.map((p) => p.x);
  const bandwidth = resolveBandwidth(gd.overall, opts.bandwidth);
  const out: Tagged<KdePoint>[] = [];
  for (const g of selectGroups(gd, opts)) {
    for (const p of kde(g.distribution, { ...opts, samplePoints, bandwidth })) out.push(tag(g, p));
  }
  return out;
}

function edgesOf(bins: Bin[]): number[] {
  if (bins.length === 0) return [];
  const edges = bins.map((b) => b.x0);
  edges.push(bins[bins.length - 1]!.x1);
  return edges;
}
