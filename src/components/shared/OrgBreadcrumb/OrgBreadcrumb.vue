<template>
  <div class="org-breadcrumb">
    <div class="breadcrumb-trail">
      <router-link :to="rootRoute" class="breadcrumb-link">
        {{ rootLabel }}
      </router-link>
      <template v-for="(crumb, index) in trailCrumbs" :key="index">
        <span class="breadcrumb-separator">/</span>
        <router-link v-if="crumb.route" :to="crumb.route" class="breadcrumb-link">
          {{ crumb.name }}
        </router-link>
        <span v-else class="breadcrumb-link">{{ crumb.name }}</span>
      </template>
    </div>
    <h1 class="page-title">{{ currentTitle }}</h1>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  name: 'OrgBreadcrumb',

  props: {
    pageName: {
      type: String,
      required: true
    },
    subPageName: {
      type: String,
      default: ''
    },
    pageRoute: {
      type: [Object, String],
      default: null
    },
    // For deeper nesting, pass an array of { name, route } objects
    // These are inserted between pageName and the final crumb
    crumbs: {
      type: Array,
      default: () => []
    },
    // Override the root workspace label and route (for My Workspace)
    workspaceLabel: {
      type: String,
      default: ''
    },
    workspaceRoute: {
      type: Object,
      default: null
    }
  },

  computed: {
    ...mapState(['activeOrganization']),

    rootLabel() {
      return this.workspaceLabel || this.activeOrganization?.organization?.name || 'Workspace'
    },

    rootRoute() {
      return this.workspaceRoute || { name: 'datasets-list' }
    },

    allCrumbs() {
      const result = []

      if (this.crumbs.length > 0) {
        result.push({ name: this.pageName, route: this.pageRoute })
        result.push(...this.crumbs)
      } else if (this.subPageName) {
        result.push({ name: this.pageName, route: this.pageRoute })
        result.push({ name: this.subPageName })
      } else {
        result.push({ name: this.pageName })
      }

      return result
    },

    // All crumbs except the last — shown in the breadcrumb trail as links
    parentCrumbs() {
      if (this.allCrumbs.length <= 1) return []
      return this.allCrumbs.slice(0, -1)
    },

    // All crumbs shown in the trail (including current page name)
    trailCrumbs() {
      return this.allCrumbs
    },

    // The last crumb — shown as the page title
    currentTitle() {
      const last = this.allCrumbs[this.allCrumbs.length - 1]
      return last?.name || this.pageName
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.org-breadcrumb {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  font-size: 12px;
  line-height: 1;

  .breadcrumb-link {
    color: theme.$gray_4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .breadcrumb-separator {
    margin: 0 6px;
    color: theme.$gray_3;
  }
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: theme.$purple_3;
  line-height: 1.3;
}
</style>
