<template>
  <!-- A workspace: its logo on its colours, then its name, your role, and
       the way in (Datasets, the card's own click, or Analysis). Square and
       flat, as the gallery cards. -->
  <div
    class="ws-card"
    role="link"
    tabindex="0"
    @click="open()"
    @keydown.enter="open()"
  >
    <div
      class="ws-banner"
      :style="`background-image: linear-gradient(0deg, ${colorScheme[0]}, ${colorScheme[1]});`"
    >
      <!-- Each card shows its own workspace, not the active one, so the
           organization is passed explicitly. No monogram fallback: the card
           already shows the name below, so initials would only repeat it. -->
      <workspace-logo
        :organization="workspace"
        fit="natural"
        :size="40"
        :max-width="200"
        hide-when-missing
      />
    </div>
    <div class="ws-body">
      <span class="ws-name" :title="workspace.organization.name">{{ workspace.organization.name }}</span>
      <!-- Your role and whether you were here last; the ways in over its
           end on hover, as the gallery cards' -->
      <div class="ws-foot">
        <span class="ws-note">{{ note }}</span>
        <span class="ws-actions" @click.stop>
          <button type="button" class="ws-action" @click="open('analysis')">Analysis</button>
          <button type="button" class="ws-action ws-action--open" @click="open('datasets')">Datasets</button>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import EventBus from '@/utils/event-bus'
import WorkspaceLogo from '@/components/shared/WorkspaceLogo/WorkspaceLogo.vue'
import { workspaceRole } from './workspaceCards'

export default {
  name: 'WorkspaceCard',

  components: {
    WorkspaceLogo
  },

  props: {
    workspace: {
      type: Object,
      required: true,
      default: () => ({
        organization: {
          name: "",
          id: ""
        }
      })
    },
    // The workspace you last opened (the page puts it first).
    lastOpened: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    colorScheme() {
      if (this.workspace.organization.colorTheme) {
        const theme = this.workspace.organization.colorTheme
        const keys = Object.keys(theme)
        return [keys[0], theme[keys[0]]]
      }

      return ['#808fad', '#4d628c']
    },

    note() {
      return [workspaceRole(this.workspace), this.lastOpened && 'Last opened'].filter(Boolean).join(' · ')
    }
  },

  methods: {
    // Into the workspace, on its Datasets (or Analysis) page, as the
    // switcher does.
    open(to = 'datasets') {
      this.$store.dispatch('setIsSwitchingOrganization', true)
      EventBus.$emit('switch-organization', this.workspace, { to })
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.ws-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    outline: none;
  }
  &:hover .ws-actions,
  &:focus-within .ws-actions {
    opacity: 1;
    pointer-events: auto;
  }
}

/* The logo on the workspace's colours; a wide wordmark kept off the edges. */
.ws-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88px;
  padding: 0 24px;
}

.ws-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
}
.ws-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
/* One line: the note, and over its end on hover the ways in (in the line
   on a touch screen), as the gallery cards' foot. */
.ws-foot {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 24px;
}
.ws-note {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.ws-actions {
  position: absolute;
  right: 0;
  display: flex;
  gap: 6px;
  padding-left: 12px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), theme.$white 12px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}
@media (hover: none) {
  .ws-actions {
    position: static;
    flex-shrink: 0;
    padding-left: 0;
    background: none;
    pointer-events: auto;
    opacity: 1;
  }
}
.ws-action {
  white-space: nowrap;
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.ws-action--open {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
</style>
