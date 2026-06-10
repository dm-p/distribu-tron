<script setup lang="ts">
import { computed } from "vue";
import { distribution, kde } from "distribu-tron";
import type { DistributionInput, KdeKernel } from "distribu-tron";
import { DEFAULT_GEOMETRY, kdeCurve } from "../charts";

const props = withDefaults(
  defineProps<{
    input: DistributionInput;
    bandwidth?: number | "silverman" | "scott";
    caption?: string;
  }>(),
  { caption: "" },
);

const KERNELS: KdeKernel[] = ["gaussian", "epanechnikov", "triangular", "cosine"];
const geo = DEFAULT_GEOMETRY;
const dist = computed(() => distribution(props.input));
const hasData = computed(() => dist.value.n > 0);

// Shared x-grid so the four minis align: take the gaussian KDE's sample points and reuse them.
const grid = computed(() =>
  kde(dist.value, { kernel: "gaussian", ...(props.bandwidth ? { bandwidth: props.bandwidth } : {}) }).map(
    (p) => p.x,
  ),
);

const series = computed(() =>
  KERNELS.map((kernel) => {
    const pts = kde(dist.value, {
      kernel,
      samplePoints: grid.value,
      ...(props.bandwidth ? { bandwidth: props.bandwidth } : {}),
    });
    // Straight (smooth=false) so each kernel's real shape is visible in the comparison.
    return { kernel, view: kdeCurve(pts, geo, false) };
  }),
);
</script>

<template>
  <figure class="dt-kc">
    <figcaption class="dt-kc-cap">
      {{ caption || "kde() across kernels — same data and bandwidth" }}
    </figcaption>
    <div class="dt-kc-grid">
      <figure v-for="s in series" :key="s.kernel" class="dt-kc-cell">
        <svg class="dt-chart" :viewBox="`0 0 ${geo.width} ${geo.height}`" role="img"
             :aria-label="`${s.kernel} kernel density`">
          <template v-if="hasData">
            <path :d="s.view.area" fill="var(--dt-c2)" opacity="0.12" />
            <path :d="s.view.line" fill="none" stroke="var(--dt-c2)" stroke-width="2" />
            <line class="axis" :x1="geo.padL" :x2="geo.width - geo.padR"
                  :y1="s.view.baselineY" :y2="s.view.baselineY" />
          </template>
        </svg>
        <figcaption class="dt-kc-label">{{ s.kernel }}</figcaption>
      </figure>
    </div>
  </figure>
</template>

<style scoped>
.dt-kc {
  margin: 26px 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  padding: 16px;
}
.dt-kc-cap {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  margin: 0 0 12px;
}
.dt-kc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.dt-kc-cell {
  margin: 0;
}
.dt-kc-label {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  text-align: center;
  margin-top: 4px;
}
@media (max-width: 720px) {
  .dt-kc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
