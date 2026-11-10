<script setup>
// A gallery with its filters on the left (the Workflows Library, Apps): a
// panel built as the Workflow Builder's side panels (_sidePanel.scss) that
// folds to a rail, remembered per page in this browser (storageKey); on a
// phone, a Filters button opens it as a drawer. On the right the toolbar
// (an optional lead, e.g. the view switch, then the page's search and Sort),
// the active filters as removable chips, and the page's list.
//
// Slots: filters (the panel's sections, FacetSection; rendered in the panel
// and in the drawer), lead, toolbar, default (the list).
import { ref } from "vue";
import { ArrowLeft, ArrowRight, Close } from "@element-plus/icons-vue";

const props = defineProps({
  // Where the fold state is kept (localStorage), e.g. "pennsieve.apps.filtersPanel".
  storageKey: { type: String, required: true },
  // The filters set: [{ key, value?, label }], each removable (remove: the
// chip); none, no chip row.
  chips: { type: Array, default: () => [] },
  // Folded until opened once (then remembered): the cards get the width,
  // the rail shows the filters set (My Code, Apps, the Workflows Library,
  // Public Datasets).
  defaultFolded: { type: Boolean, default: false },
});
const emit = defineEmits(["remove", "clear-all"]);

const storedOpen = () => {
  try {
    const stored = localStorage.getItem(props.storageKey);
    return stored ? stored !== "folded" : !props.defaultFolded;
  } catch {
    return !props.defaultFolded;
  }
};
const panelOpen = ref(storedOpen());
const togglePanel = () => {
  panelOpen.value = !panelOpen.value;
  try {
    localStorage.setItem(props.storageKey, panelOpen.value ? "open" : "folded");
  } catch {
    // not kept
  }
};
const drawerOpen = ref(false);
</script>

<template>
  <div class="facet-layout">
    <button
      v-if="!panelOpen"
      type="button"
      class="panel-rail facet-rail"
      title="Show the filters"
      aria-label="Show the filters"
      @click="togglePanel"
    >
      <el-icon><ArrowRight /></el-icon>
      <span class="panel-rail-label">Filters</span>
      <span v-if="chips.length" class="facet-count-badge">{{ chips.length }}</span>
    </button>
    <aside v-else class="facet-panel" aria-label="Filters">
      <div class="facets-top">
        <span class="facets-title">Filters</span>
        <button v-if="chips.length" type="button" class="facet-link" @click="emit('clear-all')">Clear filters</button>
        <button type="button" class="panel-fold" title="Fold the filters" aria-label="Fold the filters" @click="togglePanel">
          <el-icon><ArrowLeft /></el-icon>
        </button>
      </div>
      <div class="facets"><slot name="filters" /></div>
    </aside>

    <el-drawer v-model="drawerOpen" direction="ltr" size="280px" :with-header="false">
      <div class="facets-top">
        <span class="facets-title">Filters</span>
        <button v-if="chips.length" type="button" class="facet-link" @click="emit('clear-all')">Clear filters</button>
        <button type="button" class="panel-fold" title="Close the filters" aria-label="Close the filters" @click="drawerOpen = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="facets"><slot name="filters" /></div>
    </el-drawer>

    <div class="facet-main">
      <!-- A first row over the search and Sort (a view's intro and actions) -->
      <slot name="intro" />
      <div class="facet-toolbar">
        <div v-if="$slots.lead" class="facet-lead"><slot name="lead" /></div>
        <button type="button" class="filters-button" @click="drawerOpen = true">
          Filters<span v-if="chips.length" class="facet-count-badge">{{ chips.length }}</span>
        </button>
        <slot name="toolbar" />
      </div>

      <div v-if="chips.length" class="active-filters" role="group" aria-label="Active filters">
        <span v-for="chip in chips" :key="`${chip.key}:${chip.value ?? ''}`" class="active-chip">
          {{ chip.label }}
          <button type="button" class="active-chip-remove" :aria-label="`Remove filter ${chip.label}`" @click="emit('remove', chip)">
            <el-icon><Close /></el-icon>
          </button>
        </span>
        <button type="button" class="facet-link facet-link--13" @click="emit('clear-all')">Clear filters</button>
      </div>

      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../WorkflowBuilder/sidePanel";

/* The panel against the page's left and top edges, as the builder's; the
   list padded 20px/32px as the Analysis tabs, 24px from the panel. */
.facet-layout {
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 100%;
}
.facet-panel {
  flex: 0 0 232px;
  width: 232px;
  min-width: 0;
  box-sizing: border-box;
  padding: 20px 16px 24px;
  border-right: 1px solid theme.$gray_2;
}
/* Its arrow on the toolbar's middle. */
.facet-rail {
  padding-top: 33px;
}
/* Shrinks beside the panel (min-width: 0); a list can size to it
   (container), not to the viewport. */
.facet-main {
  flex: 1 1 0;
  min-width: 0;
  box-sizing: border-box;
  padding: 20px 32px 48px 24px;
  container-type: inline-size;
}

/* As the builder's inspector header: a small title, the fold on the right;
   as tall as the toolbar (the 40px search), so both start level. */
.facets-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
}
.facets-title {
  margin-right: auto;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_5;
}
.facets {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}
.facet-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.facet-link--13 {
  font-size: 13px;
}
.facet-count-badge {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: theme.$purple_3;
  color: theme.$white;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

/* One row: the lead (a view switch), the page's search filling the middle,
   Sort on the right. */
.facet-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 40px;
  margin-bottom: 16px;
}
.facet-lead {
  display: flex;
  flex-shrink: 0;
}
/* Filters opens the drawer, on a phone only. */
.filters-button {
  display: none;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}

/* The filters set, each removable; nothing when none is. */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: -4px 0 16px;
}
.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 4px 2px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 12px;
  color: theme.$gray_6;
}
.active-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: none;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_2;
    color: theme.$purple_3;
  }
}

/* A phone: the panel is a drawer; the list fills the width, 16px in; the
   lead takes its own line, then Filters and the rest. */
@media (max-width: 767px) {
  .facet-layout {
    display: block;
  }
  .facet-panel,
  .facet-rail {
    display: none;
  }
  .facet-main {
    padding: 16px;
  }
  .filters-button {
    display: inline-flex;
  }
  .facet-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .facet-lead {
    flex-basis: 100%;
  }
}
</style>
