<script setup>
// Renders a Vega or Vega-Lite chart (Altair's output) from an
// `application/vnd.vegalite.v*+json` / `application/vnd.vega.v*+json` mime
// bundle. vega-embed (with vega and vega-lite) is lazy-imported so it only
// loads when a notebook actually produces one.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import { vegaEmbedOptions } from "./vegaEmbedOptions";

const props = defineProps({
  spec: { type: Object, required: true },
  // "vega-lite" or "vega", from the mime type (a spec's $schema wins).
  mode: { type: String, default: "vega-lite" },
});

const host = ref(null);
const failed = ref("");
let result = null;
// Each render's number: an embed that finishes after a newer render started
// (or after unmount) is finalized at once instead of shown.
let seq = 0;
let unmounted = false;

function finalize(r = result) {
  try {
    r?.finalize();
  } catch (_) {
    /* ignore */
  }
  if (r === result) result = null;
}

async function render() {
  const mine = ++seq;
  const stale = () => unmounted || mine !== seq;
  await nextTick();
  if (stale() || !host.value || !props.spec) return;
  failed.value = "";
  try {
    const [{ default: embed }, { expressionInterpreter }] = await Promise.all([
      import("vega-embed"),
      import("vega-interpreter"),
    ]);
    if (stale()) return;
    finalize();
    // A fresh element per render: an embed still drawing for an older render
    // draws into its own, detached one.
    const el = document.createElement("div");
    host.value.replaceChildren(el);
    // A plain copy: vega annotates specs it's given, and the output's data is
    // a reactive object that's saved with the notebook.
    const spec = JSON.parse(JSON.stringify(props.spec));
    // A spec's own embed options (usermeta.embedOptions, which Altair sets)
    // would override ours: the menu, the editor URL its data is posted to,
    // how its data is loaded. Ours apply.
    if (spec.usermeta && typeof spec.usermeta === "object") delete spec.usermeta.embedOptions;
    const r = await embed(el, spec, vegaEmbedOptions(props.mode, expressionInterpreter));
    if (stale()) {
      finalize(r);
      return;
    }
    result = r;
  } catch (e) {
    if (stale()) return;
    // eslint-disable-next-line no-console
    console.error("VegaOutput render failed:", e);
    finalize();
    failed.value = `Could not render this Vega chart: ${e?.message || e}`;
  }
}

onMounted(render);
// Re-render when a new chart replaces this one (an updated display).
watch(() => [props.spec, props.mode], render);
onBeforeUnmount(() => {
  unmounted = true;
  finalize();
});
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
