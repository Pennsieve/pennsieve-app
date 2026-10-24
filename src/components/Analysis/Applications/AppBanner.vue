<script setup>
// An app card's banner, where the workflows show their graph: what goes in,
// the app, what comes out, top to bottom as the graphs run, on its domain's
// colour (appDomains.js). An app without an app.yml keeps its initials
// tile on grey.
import { computed } from "vue";
import { appBanner } from "./appDomains";
import { appInitials } from "./appCards";

const props = defineProps({
  app: { type: Object, required: true },
});

const MAX_TYPES = 3;
const b = computed(() => appBanner(props.app));
const shown = (types) => ({ types: types.slice(0, MAX_TYPES), more: Math.max(0, types.length - MAX_TYPES) });
const ins = computed(() => shown(b.value.inputs));
const outs = computed(() => shown(b.value.outputs));
const hasIo = computed(() => b.value.inputs.length || b.value.outputs.length);
const style = computed(() => {
  const h = b.value.hue;
  return b.value.manifest
    ? { "--ab-bg": `hsl(${h}, 60%, 96%)`, "--ab-tile": `hsl(${h}, 55%, 88%)`, "--ab-ink": `hsl(${h}, 45%, 30%)`, "--ab-line": `hsl(${h}, 30%, 75%)` }
    : { "--ab-tile": `hsl(${h}, 55%, 92%)`, "--ab-ink": `hsl(${h}, 45%, 32%)` };
});
const label = computed(() => {
  const io = hasIo.value ? `takes ${b.value.inputs.join(", ") || "any files"}, gives ${b.value.outputs.join(", ") || "any files"}` : "";
  return [b.value.domain?.label, io].filter(Boolean).join("; ");
});
</script>

<template>
  <div class="ab" :class="{ 'ab--plain': !b.manifest }" :style="style" role="img" :aria-label="label || undefined">
    <template v-if="b.manifest && hasIo">
      <div class="ab-types">
        <span v-for="t in ins.types" :key="t" class="ab-type">{{ t }}</span>
        <span v-if="ins.more" class="ab-type ab-type--more">+{{ ins.more }}</span>
        <span v-if="!ins.types.length" class="ab-type ab-type--any">Any</span>
      </div>
      <span class="ab-edge" />
    </template>

    <span class="ab-tile" :class="{ 'ab-tile--small': b.manifest && hasIo }">
      {{ appInitials(app) }}
      <svg v-if="b.domain" class="ab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path :d="b.domain.icon" />
      </svg>
    </span>

    <template v-if="b.manifest && hasIo">
      <span class="ab-edge" />
      <div class="ab-types">
        <span v-for="t in outs.types" :key="t" class="ab-type">{{ t }}</span>
        <span v-if="outs.more" class="ab-type ab-type--more">+{{ outs.more }}</span>
        <span v-if="!outs.types.length" class="ab-type ab-type--any">Any</span>
      </div>
    </template>

    <span v-if="b.domain" class="ab-domain">{{ b.domain.label }}</span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.ab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 150px;
  padding: 12px 8px 22px;
  box-sizing: border-box;
  background: var(--ab-bg);
}
.ab--plain {
  padding-bottom: 12px;
  background: theme.$gray_1;
}
.ab-types {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px;
  max-width: 100%;
}
.ab-type {
  padding: 1px 6px;
  border: 1px solid var(--ab-line);
  border-radius: 3px;
  background: theme.$white;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ab-ink);
}
.ab-type--more,
.ab-type--any {
  font-weight: 500;
  color: theme.$gray_4;
}
.ab-edge {
  width: 2px;
  height: 12px;
  background: var(--ab-line);
}
.ab-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  background: var(--ab-tile);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ab-ink);
}
.ab-tile--small {
  width: 56px;
  height: 56px;
  font-size: 19px;
}
.ab-icon {
  position: absolute;
  right: -7px;
  bottom: -7px;
  width: 22px;
  height: 22px;
  padding: 3px;
  box-sizing: border-box;
  border: 1px solid var(--ab-line);
  border-radius: 50%;
  background: theme.$white;

  path {
    fill: none;
    stroke: var(--ab-ink);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
.ab-domain {
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ab-ink);
  opacity: 0.75;
}
</style>
