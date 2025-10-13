<template>
  <div class="card-wrapper">
    <div class="top">
      <div class="title">
        <router-link :to="getWorkspaceUrl(workspace.organization.id)">
          {{ workspace.organization.name }}
        </router-link>
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
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.card-wrapper {
  width: 200px;
  height: 150px;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 4px 4px $gray_2;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 2px 6px 8px rgba(0, 0, 0, 0.15);
  }

  .top {
    background: $white;
    border-left: 1px solid $gray_2;
    border-top: 1px solid $gray_2;
    border-right: 1px solid $gray_2;
    border-radius: 4px 4px 0 0;
  }

  .bottom {
    flex: 1;
    border-radius: 0 0 4px 4px;
  }
}

.title {
  padding: 16px 8px 8px 8px;
  font-weight: 500;
  font-size: 12pt;
  justify-content: center;
  text-align: center;
  color: $purple_3;

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>