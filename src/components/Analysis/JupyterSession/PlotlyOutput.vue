<script setup>
// Renders a Plotly figure from the `application/vnd.plotly.v1+json` output
// mime bundle ({ data, layout, config }). plotly.js is lazy-imported so it only
// loads into the bundle when a notebook actually produces a Plotly chart.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";

const props = defineProps({
  // { data: [...], layout: {...}, config: {...} }
  spec: { type: Object, required: true },
});

const host = ref(null);
let Plotly = null;

// Detach from Vue's reactive proxy AND give Plotly a mutable copy — Plotly
// mutates data/layout in place, and mutating the reactive object would both be
// slow (proxy traps) and, with a deep watcher, cause an infinite render loop.
function plainClone(o) {
  try {
    return structuredClone(o);
  } catch (_) {
    return JSON.parse(JSON.stringify(o));
  }
}

async function render() {
  await nextTick();
  if (!host.value || !props.spec) return;
  try {
    if (!Plotly) {
      const mod = await import("plotly.js-dist");
      // plotly.js-dist is CommonJS — under Vite the export may be on .default
      // or be the module namespace itself.
      Plotly = mod.default || mod;
    }
    if (!Plotly || typeof Plotly.react !== "function") {
      throw new Error("plotly.js failed to load");
    }
    const { data = [], layout = {}, config = {} } = plainClone(props.spec);
    await Plotly.react(host.value, data, layout, {
      responsive: true,
      displaylogo: false,
      ...config,
    });
  } catch (e) {
    // Surface instead of failing silently.
    // eslint-disable-next-line no-console
    console.error("PlotlyOutput render failed:", e);
    if (host.value) {
      host.value.textContent = `Could not render Plotly figure: ${e?.message || e}`;
    }
  }
}

onMounted(render);
// Shallow watch: re-render only when a NEW figure replaces this one (reference
// change), never on Plotly's in-place mutations of the cloned copy.
watch(() => props.spec, render);
onBeforeUnmount(() => {
  if (Plotly && host.value) {
    try {
      Plotly.purge(host.value);
    } catch (_) {
      /* ignore */
    }
  }
});
</script>

<template>
  <div ref="host" class="nb-plotly" />
</template>

<style scoped>
.nb-plotly {
  width: 100%;
  min-height: 320px;
}
</style>
