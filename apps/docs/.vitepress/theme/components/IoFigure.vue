<script setup lang="ts">
import { computed } from "vue";
import { distribution, ecdf, histogram, kde } from "distribu-tron";
import type { DistributionInput } from "distribu-tron";
import { DEFAULT_GEOMETRY, ecdfStep, histogramBars, kdeCurve } from "../charts";

const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    kind: "histogram" | "kde" | "ecdf";
    bins?: number;
    caption?: string;
  }>(),
  { caption: "" },
);

const geo = DEFAULT_GEOMETRY;
const dist = computed(() => distribution(props.input));
const hasData = computed(() => dist.value.n > 0);

const bars = computed(() =>
  props.kind === "histogram"
    ? histogramBars(histogram(dist.value, props.bins ? { binCount: props.bins } : {}), geo)
    : null,
);
const curve = computed(() => (props.kind === "kde" ? kdeCurve(kde(dist.value), geo) : null));
const step = computed(() => (props.kind === "ecdf" ? ecdfStep(ecdf(dist.value), geo) : null));

const inputText = computed(() => {
  const input = props.input;
  if (!Array.isArray(input)) return JSON.stringify(input, null, 2);
  const rows = (input as Array<number | { value: number; weight: number }>).map((item) =>
    typeof item === "number" ? `  ${item},` : `  { value: ${item.value}, weight: ${item.weight} },`,
  );
  return `[\n${rows.join("\n")}\n]`;
});
const outLabel = computed(() =>
  props.kind === "histogram"
    ? `${bars.value?.rects.length ?? 0} bins · weights conserved`
    : props.kind === "kde"
      ? "kernel density"
      : "ECDF",
);
</script>

<template>
  <figure class="dt-io">
    <div class="dt-io-in">
      <div class="dt-io-head"><span class="dot" style="background:#ff5fcf"></span>input</div>
      <pre class="dt-io-src">{{ inputText }}</pre>
    </div>
    <figure class="dt-io-out">
      <div class="dt-io-head"><span class="dot" style="background:#5fe9ff"></span>output</div>
      <div class="dt-io-body">
      <svg class="dt-chart" :viewBox="`0 0 ${geo.width} ${geo.height}`" role="img"
           :aria-label="`${kind} of the input distribution`">
        <template v-if="hasData">
          <!-- histogram -->
          <template v-if="kind === 'histogram' && bars">
            <line v-for="(g, i) in bars.gridlines" :key="`g${i}`" class="axis"
                  :x1="geo.padL" :x2="geo.width - geo.padR" :y1="g.y" :y2="g.y" />
            <text v-for="(g, i) in bars.gridlines" :key="`gl${i}`" :x="geo.padL - 6" :y="g.y + 3"
                  text-anchor="end">{{ g.label }}</text>
            <rect v-for="(r, i) in bars.rects" :key="`r${i}`" :x="r.x" :y="r.y" :width="r.width"
                  :height="r.height" rx="1.5" opacity="0.92"
                  :fill="r.series === 1 ? 'var(--dt-c1)' : 'var(--dt-c2)'" />
            <text v-for="(t, i) in bars.xTicks" :key="`x${i}`" :x="t.x" :y="geo.height - 6"
                  text-anchor="middle">{{ t.label }}</text>
          </template>
          <!-- kde -->
          <template v-else-if="kind === 'kde' && curve">
            <path :d="curve.area" fill="var(--dt-c2)" opacity="0.12" />
            <path :d="curve.line" fill="none" stroke="var(--dt-c2)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="curve.baselineY" :y2="curve.baselineY" />
          </template>
          <!-- ecdf -->
          <template v-else-if="kind === 'ecdf' && step">
            <path :d="step.line" fill="none" stroke="var(--dt-c1)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="step.baselineY" :y2="step.baselineY" />
          </template>
        </template>
        <text v-else :x="geo.width / 2" :y="geo.height / 2" text-anchor="middle">no data</text>
      </svg>
      <figcaption>{{ caption || outLabel }}</figcaption>
      </div>
    </figure>
  </figure>
</template>

<style scoped>
/* The input panel renders a plain <pre> (not a VitePress code block), so give it
   the same code-surface treatment and keep long inputs scrollable, not overflowing. */
.dt-io-src {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  white-space: pre;
  overflow: auto;
  max-height: 232px;
}

/* The vendored CSS pads .dt-io-out (header included), which pushes the OUTPUT
   header down and inset vs the flush INPUT header. Make the output header flush
   on both sides and move the padding to an inner body, so the two panel headers
   line up. (Scoped specificity 0,4,0 beats the vendored .dt-io .dt-io-out.) */
.dt-io .dt-io-out {
  padding: 0;
}
.dt-io-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
}
</style>
