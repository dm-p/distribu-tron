import type {
  Accessor, Bin, Distribution, DistributionGroup, GroupSpec, GroupedDistribution, GroupKeyValue,
  HistogramOptions, KdeOptions, KdePoint, LevelSelect, SummaryStatistics, WeightedValue,
} from "./types";
import { distribution } from "./distribution";
import { histogram } from "./histogram";
import { kde } from "./kde";
import { summary } from "./summary";

function acc<T>(a: Accessor<T>): (row: Record<string, unknown>) => T {
  return typeof a === "function" ? a : (row) => row[a] as T;
}

/**
 * Group rows into per-key {@link Distribution}s. Returns the leaf groups, the `overall` distribution,
 * and (with `rollup: true`) prefix-ROLLUP subtotals + a grand total tagged by `level`/`depth`.
 * Rolled-up dimensions take `spec.totalLabel`, which **defaults to `null`** — consumers filtering by
 * key equality must handle `null` (or pass an explicit label like `"(All)"`).
 */
export function group(rows: ReadonlyArray<Record<string, unknown>>, spec: GroupSpec): GroupedDistribution {
  const dimensions = Array.isArray(spec.by) ? spec.by : [spec.by];
  const totalLabel = spec.totalLabel ?? null;
  const getValue = acc<number>(spec.value);
  const getWeight = spec.weight ? acc<number>(spec.weight) : () => 1;

  // 1. Bucket rows into leaf groups keyed by the full dimension tuple.
  const leafBuckets = new Map<string, { key: Record<string, GroupKeyValue>; pairs: WeightedValue[] }>();
  const allPairs: WeightedValue[] = [];
  for (const row of rows) {
    const keyObj: Record<string, GroupKeyValue> = {};
    for (const dim of dimensions) keyObj[dim] = row[dim] as GroupKeyValue;
    const id = JSON.stringify(dimensions.map((dim) => keyObj[dim]));
    let bucket = leafBuckets.get(id);
    if (!bucket) { bucket = { key: keyObj, pairs: [] }; leafBuckets.set(id, bucket); }
    const pair = { value: getValue(row), weight: getWeight(row) };
    bucket.pairs.push(pair);
    allPairs.push(pair);
  }

  const leaves: DistributionGroup[] = Array.from(leafBuckets.values()).map((b) => ({
    key: b.key,
    level: [...dimensions],
    depth: dimensions.length,
    distribution: distribution(b.pairs, { sorted: spec.sorted }),
  }));

  const overall = distribution(allPairs, { sorted: spec.sorted });

  let groups: DistributionGroup[] = leaves;
  if (spec.rollup) {
    const subtotals: DistributionGroup[] = [];
    // Prefix ROLLUP: for depth = dims-1 down to 1, group leaves by the first `depth` dims.
    for (let depth = dimensions.length - 1; depth >= 1; depth--) {
      const activeDims = dimensions.slice(0, depth);
      const buckets = new Map<string, { key: Record<string, GroupKeyValue>; pairs: WeightedValue[] }>();
      for (const b of leafBuckets.values()) {
        const key: Record<string, GroupKeyValue> = {};
        for (let i = 0; i < dimensions.length; i++) key[dimensions[i]!] = i < depth ? b.key[dimensions[i]!]! : totalLabel;
        const id = JSON.stringify(activeDims.map((dim) => key[dim]));
        let bucket = buckets.get(id);
        if (!bucket) { bucket = { key, pairs: [] }; buckets.set(id, bucket); }
        bucket.pairs.push(...b.pairs);
      }
      for (const bk of buckets.values()) {
        subtotals.push({ key: bk.key, level: activeDims, depth, distribution: distribution(bk.pairs, { sorted: spec.sorted }) });
      }
    }
    const grandKey: Record<string, GroupKeyValue> = {};
    for (const dim of dimensions) grandKey[dim] = totalLabel;
    const grand: DistributionGroup = { key: grandKey, level: [], depth: 0, distribution: overall };
    groups = [...leaves, ...subtotals, grand];
  }

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
  return gd.groups.filter((g) =>
    g.depth === leafDepth ||
    (sel.includeSubtotals && g.depth > 0 && g.depth < leafDepth) ||
    (sel.includeOverall && g.depth === 0),
  );
}

function tag<T extends object>(g: DistributionGroup, row: T): Tagged<T> {
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
export function groupedHistogram(
  gd: GroupedDistribution,
  opts: HistogramOptions & LevelSelect = {},
): Tagged<Bin>[] {
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
 */
export function groupedKde(
  gd: GroupedDistribution,
  opts: KdeOptions & LevelSelect = {},
): Tagged<KdePoint>[] {
  // Shared sample points + bandwidth from the overall rollup.
  const template = kde(gd.overall, opts);
  const samplePoints = template.map((p) => p.x);
  const bandwidth = resolveSharedBandwidth(gd.overall, opts.bandwidth);
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

function resolveSharedBandwidth(overall: Distribution, bw: KdeOptions["bandwidth"]): number {
  // Manual bandwidth passes through; otherwise derive Silverman once from the overall
  // rollup so every group's curve uses the same width (comparable across groups).
  return typeof bw === "number" ? bw : silvermanFor(overall);
}

function silvermanFor(d: Distribution): number {
  if (d.size === 0 || d.n <= 0) return 0;
  const q = (p: number) => { const r = Math.max(0, Math.min(p * (d.n - 1), d.n - 1)); let lo = 0, hi = d.size; while (lo < hi) { const m = (lo + hi) >>> 1; if (d.cumulative[m]! <= r) lo = m + 1; else hi = m; } return d.values[Math.min(lo, d.size - 1)]!; };
  const iqr = q(0.75) - q(0.25);
  let s = 0; for (let i = 0; i < d.size; i++) s += d.values[i]! * d.weights[i]!;
  const mu = s / d.n;
  let ss = 0; for (let i = 0; i < d.size; i++) { const x = d.values[i]! - mu; ss += d.weights[i]! * x * x; }
  const sd = Math.sqrt(Math.max(0, ss / d.n));
  return 1.06 * Math.min(iqr / 1.349, sd) * Math.pow(d.n, -0.2);
}
