<template>
  <!-- trailTitle: the trail is the title, one row; its last crumb is the
       heading (Analysis: the tabs name the rest). -->
  <div v-if="trailTitle" class="org-breadcrumb trail-title">
    <div class="page-title-row">
      <nav class="title-trail" aria-label="Breadcrumb">
        <router-link :to="rootRoute" class="breadcrumb-link">
          {{ rootLabel }}
        </router-link>
        <template v-for="(crumb, index) in parentCrumbs" :key="index">
          <span class="breadcrumb-separator">/</span>
          <router-link v-if="crumb.route" :to="crumb.route" class="breadcrumb-link">
            {{ crumb.name }}
          </router-link>
          <span v-else class="breadcrumb-link">{{ crumb.name }}</span>
        </template>
        <span class="breadcrumb-separator">/</span>
      </nav>
      <h1 class="page-title" :title="currentTitle" :style="titleStyle">{{ currentTitle }}</h1>
      <span id="page-title-extra" class="page-title-extra" />
      <span v-if="actions" id="page-title-actions" class="page-title-actions" />
    </div>
  </div>
  <div v-else class="org-breadcrumb">
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
    <div class="page-title-row">
      <h1 class="page-title" :style="titleStyle">{{ currentTitle }}</h1>
      <!-- A page can put something next to its title here (a compute node's
           status), with <Teleport defer to="#page-title-extra">. -->
      <span id="page-title-extra" class="page-title-extra" />
      <!-- A page's primary actions, on the row's right (Analysis: the tab's
           AnalysisViewBar teleports them here). -->
      <span v-if="actions" id="page-title-actions" class="page-title-actions" />
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import CustomTheme from '@/mixins/custom-theme'
import { readableOnWhite } from '@/utils/readableOnWhite'

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
    },
    // Has a place for the page's actions on the title row's right
    // (#page-title-actions), as tall as them, so the row doesn't move.
    actions: {
      type: Boolean,
      default: false
    },
    // One row: the trail's parents, then its last crumb as the heading (every
    // page's header); false, the older two rows (a small trail over a large
    // title).
    trailTitle: {
      type: Boolean,
      default: true
    }
  },

  mixins: [CustomTheme],

  computed: {
    // The title in the workspace's own colour (its primary, as the nav's),
    // darkened until it reads on white (4.5:1); outside a workspace (My
    // Workspace) or without a theme, the default navy.
    titleStyle() {
      if (this.workspaceLabel) return null
      const color = readableOnWhite(this.getTheme()[0])
      return color ? { color } : null
    },

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
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
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

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.page-title-extra {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
/* On the row's right, flush with the content's right edge below (32px
   in; the rafter pads its right 8px, so 24px more). */
.page-title-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 36px;
  margin-left: auto;
  margin-right: 24px;
}
/* A phone: the actions under the heading. */
@media (max-width: 767px) {
  .page-title-row {
    flex-wrap: wrap;
  }
  .page-title-actions {
    flex-basis: 100%;
    justify-content: flex-start;
    margin-left: 0;
    margin-right: 0;
  }
  .page-title-actions:empty {
    display: none;
  }
}
/* The trail as the title: muted parents on the heading's baseline; the
   workspace name gives way first on a narrow screen. */
.trail-title .page-title-row {
  align-items: baseline;
  gap: 0;
}
/* Shrinks before the title, down to its crumbs' minimum widths. */
.title-trail {
  display: flex;
  flex-shrink: 100;
  align-items: baseline;
  font-size: 16px;
  white-space: nowrap;

  .breadcrumb-link {
    overflow: hidden;
    text-overflow: ellipsis;
    color: theme.$gray_4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
  /* The workspace name gives way first; then the crumbs between (a long
  dataset name), down to a few letters each, cut with an ellipsis. */
  .breadcrumb-link {
    flex-shrink: 1;
    min-width: 48px;
  }
  .breadcrumb-link:first-child {
    flex-shrink: 100;
  }
  .breadcrumb-separator {
    flex-shrink: 0;
    margin: 0 8px;
    color: theme.$gray_3;
  }
}
/* Then a long title (an app's repository) is cut, never the actions. */
.trail-title .page-title {
  flex-shrink: 1;
  min-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trail-title .page-title-extra {
  flex-shrink: 0;
  margin-left: 12px;
  align-self: center;
  white-space: nowrap;
}
/* Nothing in it (a section's actions are in its content), no height: the
   title row is the title's, and the tabs sit closer. */
.trail-title .page-title-actions:empty {
  min-height: 0;
}
.trail-title .page-title-actions {
  flex-shrink: 0;
  align-self: center;
  padding-left: 16px;

  :deep(.bf-button) {
    white-space: nowrap;
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

<style lang="scss">
/* Every page's header (the rafter around a one-row breadcrumb title): 70px
   with its rule, the title centred, so the rule is at 69px from the top,
   where the nav's divider under its first row is (the workspace switcher:
   8px + 56px, its line 5px under; the secondary nav's heading, 69px). One
   line across the nav and the page. Unscoped: it styles the rafter around. */
.bf-rafter.compact.primary:has(.org-breadcrumb.trail-title) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 70px;
  padding-top: 0;
  padding-bottom: 0;

  > .rafter-inset {
    flex: 1;
    min-width: 0;
  }
  .bf-rafter-breadcrumb {
    margin-bottom: 0;
  }
}
/* Tabs right under it (Publishing, a dataset's Activity or Permissions):
   their rule is the header's only one, as in Analysis. */
.bf-rafter.compact.primary:has(.org-breadcrumb.trail-title):has(+ .content-tabs) {
  border-bottom: none;
}
/* A phone: the title row can wrap (its actions under the title), so the
   header grows from 70px instead of cutting it off. */
@media (max-width: 767px) {
  .bf-rafter.compact.primary:has(.org-breadcrumb.trail-title) {
    height: auto;
    min-height: 70px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
}
</style>
