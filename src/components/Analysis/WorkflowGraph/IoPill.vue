<script setup>
/*
  A workflow's input or output on a graph (the builder's and a run's): a pill
  where data enters or results leave, so it reads apart from the steps
  between. One size (200×44), as the layouts place it. Its colour says which
  it is (input indigo, output slate); its border, its state on a run's graph
  (red when failed, pulsing while running), as a step card's does; an ended
  one has the card's ✓ ✕ – mark.

  slot: extra controls on the pill (the builder's remove button).
*/
defineProps({
  kind: { type: String, default: "input" }, // input | output
  name: { type: String, default: "" },
  // A second line: files chosen, where it goes, an import's progress.
  sub: { type: String, default: "" },
  // statusMarkOf(): { glyph, kind: done | failed | canceled }, or null
  mark: { type: Object, default: null },
  markTitle: { type: String, default: "" },
  running: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  // How many things it still needs (a red count, as on step cards).
  unmet: { type: Number, default: 0 },
  // Turned off for this run: not saved, or left out.
  off: { type: Boolean, default: false },
});
</script>

<template>
  <div
    class="io-pill"
    :class="[`io-pill--${kind}`, { 'is-running': running, 'is-failed': failed, 'is-off': off }]"
  >
    <span v-if="unmet > 0" class="io-pill__unmet">{{ unmet }}</span>
    <span class="io-pill__icon" aria-hidden="true">
      <svg v-if="kind === 'input'" viewBox="0 0 24 24" width="14" height="14"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <svg v-else viewBox="0 0 24 24" width="14" height="14"><path d="M12 20V8m0 0l-5 5m5-5l5 5M5 4h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </span>
    <span class="io-pill__text">
      <span class="io-pill__name" :title="name">{{ name }}</span>
      <span v-if="sub" class="io-pill__sub" :title="sub">{{ sub }}</span>
    </span>
    <span
      v-if="mark"
      class="io-pill__mark"
      :class="`io-pill__mark--${mark.kind}`"
      :title="markTitle || undefined"
      :aria-label="markTitle || undefined"
    >{{ mark.glyph }}</span>
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.io-pill {
  --io-color: #6366f1;
  --io-border: var(--io-color);
  position: relative;
  /* Over its connection point, as a step card is: half of it shows. */
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 200px;
  min-height: 44px;
  padding: 6px 14px 6px 8px;
  border: 2px solid var(--io-border);
  border-radius: 999px;
  /* The light tint of its colour that input data and outputs have always had */
  background: #eef2ff;

  &--output {
    --io-color: #64748b;
    background: #f1f5f9;
  }
  &.is-failed {
    --io-border: #{theme.$status_red};
  }
  &.is-running {
    --io-border: #06b6d4;
    animation: io-pill-pulse 1.6s ease-in-out infinite;
  }
  &.is-off {
    opacity: 0.55;
    border-style: dashed;
  }
}
@keyframes io-pill-pulse {
  0%, 100% { border-color: var(--io-border); }
  50% { border-color: transparent; }
}
.io-pill__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: theme.$white;
  color: var(--io-color);
}
.io-pill__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.io-pill__name,
.io-pill__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.io-pill__name {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.io-pill__sub {
  font-size: 11px;
  color: theme.$gray_4;
}
.io-pill__mark {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 700;

  &--done { color: theme.$status_green; }
  &--failed { color: theme.$status_red; }
  &--canceled { color: theme.$gray_4; }
}
.io-pill__unmet {
  position: absolute;
  top: -8px;
  left: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: theme.$status_red;
  color: theme.$white;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
</style>
