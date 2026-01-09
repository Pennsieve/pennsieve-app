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
    </div>
  </div>
</template>

<script>
import * as siteConfig from '@/site-config/site.json'
import EventBus from '@/utils/event-bus'

export default {
  name: 'WorkspaceCard',
  
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
    transform: translateY(-2px);
    box-shadow: 2px 6px 8px rgba(0, 0, 0, 0.15);
  }

  .top {
    background: theme.$white;
    border-left: 1px solid theme.$gray_2;
    border-top: 1px solid theme.$gray_2;
    border-right: 1px solid theme.$gray_2;
  }

  .bottom {
    flex: 1;
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