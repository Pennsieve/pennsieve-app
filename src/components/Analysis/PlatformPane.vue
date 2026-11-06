<script setup>
// The chosen data platform's picker, under its name and what it gives the
// notebook (its module's title, intro and picker: platforms/): the right
// column beside PlatformList, in the new notebook dialog and a running
// session's "Add data". Each picker is bound to its platform's part of the
// selection (platformSelection), a v-model per field, so moving between
// platforms keeps what was chosen on each.
import { computed } from "vue";
import PlatformMark from "./PlatformMark.vue";
import { PLATFORMS } from "./platforms";

const props = defineProps({
  platform: { type: String, required: true },
  // platformSelection's newSelection().
  selection: { type: Object, required: true },
  // A note on what's chosen ("" for none): (key, part) => why none of the
  // user's nodes can reach it. Pickers that list datasets take it per
  // dataset (a platform's pickerProps({ datasetNote })).
  noteOf: { type: Function, default: null },
});

const p = computed(() => PLATFORMS[props.platform]);
const datasetNote = (d) => props.noteOf?.(props.platform, { ...props.selection[props.platform], dataset: d }) || "";
const pickerProps = computed(() => {
  const pp = p.value?.pickerProps;
  return typeof pp === "function" ? pp({ datasetNote }) : pp;
});
// The picker's v-model:<field> for each field of the platform's part.
const models = computed(() => {
  const part = props.selection[props.platform];
  const out = {};
  for (const field of Object.keys(part || {})) {
    out[field] = part[field];
    out[`onUpdate:${field}`] = (v) => (part[field] = v);
  }
  return out;
});
</script>

<template>
  <div v-if="p" class="pp">
    <h4 class="pp__title">
      <PlatformMark :platform="platform" :size="24" />
      {{ p.title }}
    </h4>
    <p class="pp__desc">
      <template v-for="(bit, i) in p.intro" :key="i">
        <a v-if="typeof bit === 'object'" :href="bit.href" target="_blank" rel="noopener">{{ bit.text }}</a>
        <template v-else>{{ bit }}</template>
      </template>
    </p>
    <component :is="p.picker" :key="platform" class="pp__picker" v-bind="{ ...pickerProps, ...models }" />
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pp {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
/* A picker fills the column, and its list of results (each picker marks it
   pp-list) the rest of it: the dialog sets the height, the list scrolls
   inside. */
.pp__picker {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.pp__picker :deep(.pp-list) {
  flex: 1 1 auto;
  min-height: 160px;
  max-height: none;
}
.pp__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pp__desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;

  a {
    color: theme.$purple_2;
  }
}
</style>
