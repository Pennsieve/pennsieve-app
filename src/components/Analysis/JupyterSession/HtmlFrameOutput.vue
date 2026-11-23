<script setup>
// An HTML output that needs JavaScript (Bokeh, pyvis, ...), in a sandboxed
// iframe: allow-scripts only, so its document has an opaque origin and can't
// reach the app's DOM, cookies, storage or tokens, navigate the page or open
// windows. The frame posts its height; it grows to fit up to a maximum, then
// scrolls.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { buildSrcdoc, externalScriptHosts, frameHeight } from "./htmlFrameHelpers";

const props = defineProps({
  // The output's text/html, unsanitized (it only ever runs in the frame).
  html: { type: String, required: true },
});

const frame = ref(null);
const height = ref(80);

const srcdoc = computed(() => buildSrcdoc(props.html));
// The app's Content-Security-Policy applies in the frame too, so scripts from
// other hosts don't load.
const blockedHosts = computed(() => externalScriptHosts(props.html));

function onMessage(event) {
  const h = frameHeight(event, frame.value?.contentWindow);
  if (h != null) height.value = h;
}

onMounted(() => window.addEventListener("message", onMessage));
onBeforeUnmount(() => window.removeEventListener("message", onMessage));
</script>

<template>
  <div class="nb-frame">
    <iframe
      ref="frame"
      class="nb-frame__iframe"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      title="Notebook output"
      :srcdoc="srcdoc"
      :style="{ height: `${height}px` }"
    />
    <p v-if="blockedHosts.length" class="nb-frame__note">
      This output loads code from {{ blockedHosts.join(", ") }}, which the notebook viewer blocks;
      use the library’s inline/offline mode (e.g. Bokeh’s <code>resources=INLINE</code>
      or Plotly’s <code>include_plotlyjs=True</code>).
    </p>
  </div>
</template>

<style scoped>
.nb-frame__iframe {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
}
.nb-frame__note {
  margin: 2px 0;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #71564a; /* warn text */
}
.nb-frame__note code {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.92em;
}
</style>
