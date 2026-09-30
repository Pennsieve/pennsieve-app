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
        <!-- Collapsed: on the icon's corner, inside the narrow rail. -->
        <span v-if="condensed && store.attentionCount" class="nav-badge on-icon">
          {{ store.attentionCount }}
        </span>
      </div>
      <span v-if="!condensed" class="label">{{ label }}</span>
      <span v-if="!condensed && store.attentionCount" class="nav-badge">
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

  .icon-main {
    position: relative;
    overflow: visible;
  }
}

.nav-badge {
  display: inline-block;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  // A count, not a warning: the brand navy, outlined so it shows on every
  // workspace's rail colour.
  background: theme.$purple_3;
  color: theme.$white;
  box-shadow: 0 0 0 1px theme.$white;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;

  // Just off the icon's top-right corner (the icon is 20px), still inside
  // the collapsed rail.
  &.on-icon {
    position: absolute;
    top: -11px;
    left: 13px;
    min-width: 15px;
    padding: 0 4px;
    font-size: 9px;
    line-height: 15px;
    border-radius: 8px;
    pointer-events: none;
  }
}
</style>
