import { onBeforeUnmount, onMounted } from "vue";

// Where an Analysis tab's content starts, as --analysis-stage-top on the
// document: the full-height views size themselves to the viewport below it
// (calc(100vh - var(--analysis-stage-top, 112px))). Measured, since the
// header above changes: the sub-tab row shows only when a tab has views or
// actions, and the title row wraps on a narrow screen.
export function useAnalysisStageTop(markerRef, headerRefs) {
  let observer = null;
  const root = document.documentElement;

  const update = () => {
    const marker = markerRef.value;
    if (!marker) return;
    root.style.setProperty("--analysis-stage-top", `${Math.round(marker.getBoundingClientRect().top)}px`);
  };

  onMounted(() => {
    update();
    observer = new ResizeObserver(update);
    for (const r of headerRefs) {
      if (r.value) observer.observe(r.value);
    }
    window.addEventListener("resize", update);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("resize", update);
    root.style.removeProperty("--analysis-stage-top");
  });
}
