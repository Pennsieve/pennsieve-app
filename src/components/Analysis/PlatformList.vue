<script setup>
// The data platforms to choose from (dataPlatforms PLATFORM_GROUPS, one
// group): each with its mark, what it holds and how big it is.
// The left column of the new notebook dialog's data step and of a running
// session's "Add data"; PlatformPane shows the chosen one's picker.
import { computed } from "vue";
import PlatformMark from "./PlatformMark.vue";
import { DATA_PLATFORMS, groupsOf, platformCount } from "./dataPlatforms";
import { usePlatformCounts } from "./usePlatformCounts";

const props = defineProps({
  // The platforms offered, by key (all by default).
  offered: { type: Array, default: () => Object.keys(DATA_PLATFORMS) },
  // A platform's note, under its count (one the user's nodes can't reach).
  noteOf: { type: Function, default: null },
});
// The platform chosen, by key; "" for none of them.
const platform = defineModel({ type: String, default: "" });

const groups = computed(() => groupsOf(props.offered));
const counts = usePlatformCounts(props.offered);
const line = (key) => platformCount(counts[key], DATA_PLATFORMS[key].noun);
</script>

<template>
  <div class="pl">
    <template v-for="(g, i) in groups" :key="g.label">
      <div class="pl__label" :class="{ 'pl__label--next': i > 0 }">{{ g.label }}</div>
      <div class="pl__choices" role="radiogroup" :aria-label="g.label">
        <button
          v-for="key in g.keys"
          :key="key"
          type="button"
          role="radio"
          class="pl__choice"
          :class="{ 'is-picked': platform === key }"
          :aria-checked="platform === key"
          @click="platform = key"
        >
          <PlatformMark :platform="key" />
          <span class="pl__text">
            <span class="pl__name">{{ DATA_PLATFORMS[key].name }}</span>
            <span class="pl__desc">{{ DATA_PLATFORMS[key].desc }}</span>
            <span v-if="line(key)" class="pl__count">{{ line(key) }}</span>
            <span v-if="noteOf && noteOf(key)" class="pl__note">{{ noteOf(key) }}</span>
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pl__label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.pl__label--next {
  margin-top: 16px;
}
.pl__choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pl__choice {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  /* Chosen: its whole outline in purple and a faint tint (an accent on
     one side would curl round the corners). */
  &.is-picked {
    border-color: theme.$purple_3;
    background: theme.$gray_1;
  }
}
.pl__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pl__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pl__desc {
  font-size: 11px;
  line-height: 1.35;
  color: theme.$gray_4;
}
.pl__count {
  margin-top: 2px;
  font-size: 12px;
  color: theme.$gray_4;
}
.pl__note {
  margin-top: 2px;
  font-size: 12px;
  color: theme.$orange_2;
}
</style>
