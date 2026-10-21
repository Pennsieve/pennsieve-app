<template>
  <div class="card-wrapper" @click="handleWorkspaceClick">
    <div class="top">
      <div class="title">
        <a href="#" @click.prevent>
          {{ workspace.organization.name }}
        </a>
      </div>
    </div>
    <div 
      class="bottom" 
      :style="`background-image: linear-gradient(0deg, ${colorScheme[0]}, ${colorScheme[1]});`"
    >
      <!-- Each card shows its own workspace, not the active one, so the
           organization is passed explicitly. No monogram fallback: the card
           already shows the name directly above, so initials would only
           repeat it. -->
      <workspace-logo
        :organization="workspace"
        fit="natural"
        :size="40"
        :max-width="150"
        hide-when-missing
      />
    </div>
  </div>
</template>

<script>
import * as siteConfig from '@/site-config/site.json'
import EventBus from '@/utils/event-bus'
import WorkspaceLogo from '@/components/shared/WorkspaceLogo/WorkspaceLogo.vue'

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
    }
  },

  methods: {
    getWorkspaceUrl(workspaceId) {
      return `/${workspaceId}/datasets`
    },

    handleWorkspaceClick() {
      // Set loading state to true before switching
      this.$store.dispatch('setIsSwitchingOrganization', true)
      
      // Emit the switch-organization event just like UserMenu does
      EventBus.$emit('switch-organization', this.workspace)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.card-wrapper {
  width: 200px;
  height: 150px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.01);
    
    .top {
      background: theme.$gray_1;
      border-color: theme.$gray_2;
    }
  }

  .top {
    background: theme.$white;
    border-left: 1px solid theme.$gray_2;
    border-top: 1px solid theme.$gray_2;
    border-right: 1px solid theme.$gray_2;
  }

  .bottom {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
    // Keeps a wide wordmark off the card's edges.
    padding: 0 16px;
  }
}

.title {
  padding: 16px 8px 8px 8px;
  font-weight: 500;
  font-size: 12pt;
  justify-content: center;
  text-align: center;
  color: theme.$purple_3;

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>