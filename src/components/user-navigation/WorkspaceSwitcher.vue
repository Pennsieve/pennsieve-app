<script setup>
// The top of the navigation, in My Workspace and in a workspace: where you
// are, and a menu to go to My Workspace, another of your workspaces, or
// all of them (Shared Workspaces). Condensed, the mark alone opens it. A
// workspace's mark (its logo) comes in the mark slot; a logo that is its
// name (a wordmark) stands for the name (showName false).
import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import EventBus from "@/utils/event-bus";
import IconPennsieveMark from "../icons/IconPennsieveMark.vue";
import IconArrowDown from "../icons/IconArrowDown.vue";
import IconCheck from "../icons/IconCheck.vue";

const props = defineProps({
  condensed: { type: Boolean, default: false },
  // The workspace you're in; none: My Workspace.
  currentId: { type: String, default: "" },
  name: { type: String, default: "My Workspace" },
  showName: { type: Boolean, default: true },
  // On the page of all your workspaces (Shared Workspaces): the switcher is
  // its menu item, marked as the items are.
  active: { type: Boolean, default: false },
});
const inMyWorkspace = computed(() => !props.currentId);

const store = useStore();
const router = useRouter();
const open = ref(false);
const query = ref("");

// Your workspaces as the profile menu lists them: not those you're a guest
// in, nor Welcome, by name.
const workspaces = computed(() =>
  (store.state.organizations || [])
    .filter((o) => !(o.isGuest || o.organization?.isGuest) && o.organization?.name && o.organization.name !== "Welcome")
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name, undefined, { sensitivity: "base" }))
);
// A filter once the list is long.
const FILTER_FROM = 8;
const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? workspaces.value.filter((o) => o.organization.name.toLowerCase().includes(q)) : workspaces.value;
});

function switchTo(org) {
  open.value = false;
  if (org.organization.id !== props.currentId) EventBus.$emit("switch-organization", org);
}
function goTo(name) {
  open.value = false;
  router.push({ name });
}
</script>

<template>
  <el-popover
    v-model:visible="open"
    trigger="click"
    :placement="condensed ? 'right-start' : 'bottom-start'"
    :width="240"
    :show-arrow="false"
    :offset="condensed ? 8 : 4"
    popper-class="workspace-switcher-popper"
    @after-leave="query = ''"
  >
    <template #reference>
      <button
        type="button"
        class="switcher"
        :class="{ 'is-condensed': condensed, 'is-open': open, 'is-active': active }"
        aria-haspopup="menu"
        :aria-current="active ? 'page' : undefined"
        :aria-expanded="open"
        :title="condensed || !showName ? `${name}: switch workspace` : undefined"
      >
        <span class="switcher-mark">
          <slot name="mark">
            <IconPennsieveMark :width="20" :height="20" color="currentColor" />
          </slot>
        </span>
        <template v-if="!condensed">
          <span v-if="showName" class="switcher-text">
            <span class="switcher-name">{{ name }}</span>
            <span class="switcher-hint">Switch workspace</span>
          </span>
          <span v-else class="switcher-text" />
          <IconArrowDown class="switcher-caret" :width="10" :height="10" color="currentColor" />
        </template>
      </button>
    </template>

    <div class="ws-menu" role="menu">
      <div class="ws-menu-title">Switch workspace</div>
      <el-input
        v-if="workspaces.length >= FILTER_FROM"
        v-model="query"
        size="small"
        placeholder="Find a workspace…"
        clearable
        class="ws-filter"
      />
      <div class="ws-list">
        <button
          type="button"
          class="ws-item ws-item--mine"
          :class="{ 'is-current': inMyWorkspace }"
          role="menuitem"
          @click="goTo('shared-with-me')"
        >
          <IconPennsieveMark class="ws-mine-mark" :width="14" :height="14" color="currentColor" />
          <span class="ws-name">My Workspace</span>
          <IconCheck v-if="inMyWorkspace" class="ws-check" :width="16" :height="16" />
        </button>
        <div class="ws-divider" />
        <button
          v-for="org in shown"
          :key="org.organization.id"
          type="button"
          class="ws-item"
          :class="{ 'is-current': org.organization.id === currentId }"
          role="menuitem"
          :title="org.organization.name"
          @click="switchTo(org)"
        >
          <span class="ws-name">{{ org.organization.name }}</span>
          <IconCheck v-if="org.organization.id === currentId" class="ws-check" :width="16" :height="16" />
        </button>
        <div v-if="!shown.length" class="ws-empty">
          {{ workspaces.length ? "No workspace matches" : "You're not in a shared workspace yet" }}
        </div>
      </div>
      <button type="button" class="ws-all" role="menuitem" @click="goTo('shared-workspaces')">
        All shared workspaces
      </button>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
@use "../../styles/_theme.scss";

/* The nav's top row, as its items (UserNavigationItem, the workspace nav's
   alike): square, the full width, 56px, the icon in their 20px column,
   lighter on hover and while open; a divider below. */
.switcher {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 56px;
  margin: 8px 0 9px;
  padding: 0 24px;
  border: none;
  background: transparent;
  color: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.1);
    outline: none;
  }
  &.is-open,
  &.is-active {
    background: rgba(255, 255, 255, 0.15);
  }
  // As an active item's: an orange bar on the left.
  &.is-active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #ff8300;
  }

  &::after {
    content: "";
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: -5px;
    height: 1px;
    background: rgba(255, 255, 255, 0.12);
  }

  &.is-condensed {
    justify-content: center;
    padding: 0;

    &::after {
      left: 12px;
      right: 12px;
    }
  }
}
/* The mark in the items' icon column; a workspace's logo keeps its own
   width (a wordmark), at most the row's. */
.switcher-mark {
  display: flex;
  flex-shrink: 1;
  align-items: center;
  min-width: 20px;
  max-width: 100%;
  margin-right: 24px;

  .is-condensed & {
    margin-right: 0;
  }
}
.switcher-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.switcher-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
}
.switcher-hint {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.7;
}
.switcher-caret {
  flex-shrink: 0;
  opacity: 0.8;
}

/* The menu. */
.ws-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ws-menu-title {
  padding: 2px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.ws-filter {
  margin: 0 0 4px;
}
.ws-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
}
.ws-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  &.is-current {
    font-weight: 600;
  }
}
.ws-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ws-mine-mark {
  flex-shrink: 0;
  color: theme.$purple_3;
}
.ws-divider {
  height: 1px;
  margin: 4px 0;
  background: theme.$gray_2;
}
.ws-check {
  flex-shrink: 0;
  color: theme.$purple_3;
}
.ws-empty {
  padding: 6px 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
.ws-all {
  margin-top: 4px;
  padding: 8px 8px 2px;
  border: none;
  border-top: 1px solid theme.$gray_2;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$link-color;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
</style>
