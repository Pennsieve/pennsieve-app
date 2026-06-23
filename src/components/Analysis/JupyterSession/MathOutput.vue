<script setup>
// Renders a `text/latex` output with KaTeX (lazy-loaded). Handles both the
// delimited form (IPython Math()/sympy emit "$…$"; Latex() may emit "$$…$$")
// and bare LaTeX with no delimiters (e.g. a raw "\begin{aligned}…" block, which
// we render as display math).
import { onMounted, watch, ref, nextTick } from "vue";

const props = defineProps({
  latex: { type: String, default: "" },
});

const host = ref(null);

async function render() {
  await nextTick();
  if (!host.value) return;
  const src = props.latex || "";
  const katex = (await import("katex")).default;
  await import("katex/dist/katex.min.css");
  host.value.innerHTML = "";
  try {
    if (/\$|\\\(|\\\[/.test(src)) {
      // Delimited: render math spans in place, leave surrounding text as-is.
      const renderMathInElement = (await import("katex/contrib/auto-render")).default;
      host.value.textContent = src;
      renderMathInElement(host.value, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } else {
      // Bare LaTeX → display math.
      host.value.innerHTML = katex.renderToString(src, {
        displayMode: true,
        throwOnError: false,
      });
    }
  } catch (_) {
    host.value.textContent = src; // fall back to raw on any render error
  }
}

onMounted(render);
watch(() => props.latex, render);
</script>

<template>
  <div ref="host" class="nb-latex" />
</template>

<style scoped>
.nb-latex {
  padding: 6px 8px;
  overflow-x: auto;
  font-size: 15px;
}
</style>
