<script setup>
// Renders a Vega or Vega-Lite chart (Altair's output) from an
// `application/vnd.vegalite.v*+json` / `application/vnd.vega.v*+json` mime
// bundle. vega-embed (with vega and vega-lite) is lazy-imported so it only
// loads when a notebook actually produces one.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";

const props = defineProps({
  spec: { type: Object, required: true },
  // "vega-lite" or "vega", from the mime type (a spec's $schema wins).
  mode: { type: String, default: "vega-lite" },
});

const host = ref(null);
const failed = ref("");
let result = null;

function finalize() {
  try {
    result?.finalize();
  } catch (_) {
    /* ignore */
  }
  result = null;
}

async function render() {
  await nextTick();
  if (!host.value || !props.spec) return;
  failed.value = "";
  try {
    const { default: embed } = await import("vega-embed");
    finalize();
    // A plain copy: vega annotates specs it's given, and the output's data is
    // a reactive object that's saved with the notebook.
    const spec = JSON.parse(JSON.stringify(props.spec));
    // A spec's own embed options (usermeta.embedOptions, which Altair sets)
    // would override ours: the menu, the editor URL its data is posted to,
    // how its data is loaded. Ours apply.
    if (spec.usermeta && typeof spec.usermeta === "object") delete spec.usermeta.embedOptions;
    result = await embed(host.value, spec, {
      mode: props.mode,
      // Only the PNG/SVG export: no "open in Vega Editor" (it posts the data
      // to another site) or source views.
      actions: { export: true, source: false, compiled: false, editor: false },
      renderer: "svg",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("VegaOutput render failed:", e);
    finalize();
    failed.value = `Could not render this Vega chart: ${e?.message || e}`;
  }
}

onMounted(render);
// Re-render when a new chart replaces this one (an updated display).
watch(() => [props.spec, props.mode], render);
onBeforeUnmount(finalize);
</script>

<template>
  <div class="nb-vega">
    <div v-show="!failed" ref="host" class="nb-vega__chart" />
    <pre v-if="failed" class="nb-vega__error">{{ failed }}</pre>
  </div>
</template>

<style scoped>
.nb-vega {
  padding: 6px 8px;
  overflow-x: auto;
}
/* As wide as the chart, so the export menu sits next to it. */
.nb-vega__chart {
  display: inline-block;
  max-width: 100%;
}
.nb-vega__error {
  margin: 0;
  padding: 6px 8px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  white-space: pre-wrap;
  background: #feeeec; /* red_tint */
  color: #c14d49; /* red_2 */
}
</style>
