<template>
  <el-tooltip
    popper-class="tooltip-navigation"
    placement="right"
    :content="label"
    :disabled="!condensed"
    :show-after="200"
  >
    <button
      type="button"
      class="bf-navigation-item downloads-nav-button"
      :style="styleColor ? { '--color-hover': styleColor } : {}"
      :aria-expanded="store.panelOpen"
      :aria-label="store.attentionCount ? `${label}: ${store.attentionCount} to check` : label"
      @click="store.panelOpen = !store.panelOpen"
    >
      <div class="svg-icon svg-fill icon-main">
        <IconDirectDownload :width="20" :height="20" color="currentColor" />
      </div>
      <span v-if="!condensed" class="label">{{ label }}</span>
      <span v-if="store.attentionCount" class="nav-badge" :class="{ condensed }">
        {{ store.attentionCount }}
      </span>
    </button>
  </el-tooltip>
</template>

<script setup>
import { useDownloadsStore } from "@/stores/downloadsStore";
import IconDirectDownload from "@/components/icons/IconDirectDownload.vue";

// Shown in the navigation while the downloads panel has something to show;
// it toggles the panel. The badge counts what needs attention: archives being
// prepared, and ready ones not downloaded yet.
defineProps({
  condensed: { type: Boolean, default: false },
  styleColor: { type: String, default: "" },
});

const store = useDownloadsStore();
const label = "Downloads";
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.downloads-nav-button {
  width: 100%;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;

  .label {
    flex: 1;
  }
}

.nav-badge {
  display: inline-block;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: theme.$red_1;
  color: theme.$white;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;

  &.condensed {
    position: absolute;
    top: 8px;
    left: 34px;
  }
}
</style>
