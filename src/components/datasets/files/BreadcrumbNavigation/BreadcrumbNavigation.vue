<template>
  <div class="breadcrumb-navigation">
    <template v-if="!ancestors || !fileId">
      Files
    </template>
    <template v-else>
      <div class="full-path">
        <span
          class="breadcrumb-item clickable"
          :class="isLightBackground && 'dark-text'"
          @click="breadcrumbNavigate()"
        >
          Files
        </span>

        <!-- Overflow dropdown for collapsed middle ancestors -->
        <template v-if="overflowBreadcrumbs.length > 0">
          <span class="breadcrumb-separator">
            <IconArrowRight
              class="breadcrumb-caret"
              :height="10"
              :width="10"
            />
          </span>
          <el-dropdown
            trigger="click"
            placement="bottom-start"
            :class="isLightBackground && 'dark-text'"
            @command="breadcrumbNavigate"
          >
            <span class="breadcrumb-item clickable overflow-trigger">...</span>
            <template #dropdown>
              <el-dropdown-menu
                class="breadcrumb-menu bf-menu"
                :arrow-offset="0"
              >
                <el-dropdown-item
                  v-for="breadcrumb in overflowBreadcrumbs"
                  :key="breadcrumb.content.id"
                  :command="breadcrumb.content.id"
                >
                  {{ breadcrumb.content.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>

        <!-- Visible tail breadcrumbs -->
        <template v-for="breadcrumb in visibleBreadcrumbs" :key="breadcrumb.content.id">
          <span class="breadcrumb-separator">
            <IconArrowRight
              class="breadcrumb-caret"
              :height="10"
              :width="10"
            />
          </span>
          <span
            class="breadcrumb-item clickable"
            :class="isLightBackground && 'dark-text'"
            @click="breadcrumbNavigate(breadcrumb.content.id)"
          >
            {{ breadcrumb.content.name }}
          </span>
        </template>

        <span class="breadcrumb-separator">
          <IconArrowRight
            class="breadcrumb-caret"
            :height="10"
            :width="10"
          />
        </span>
        <span class="collection-name" :class="isLightBackground && 'dark-text'">
          {{ file.content.name }}
        </span>
      </div>
    </template>
  </div>
</template>

<script>
import { defaultTo, isEmpty } from 'ramda'
import IconArrowRight from "../../../icons/IconArrowRight.vue";

const MAX_VISIBLE_ANCESTORS = 2

export default {
  name: 'BreadcrumbNavigation',
  components: { IconArrowRight },
  props: {
    isLightBackground: {
      type: Boolean,
      default: false
    },
    fileId: {
      type: String,
      default: ''
    },
    ancestors: {
      type: Array,
      default: () => []
    },
    file: {
      type: Object,
      default: () => {}
    }
  },

  computed: {
    breadcrumbs: function() {
      return defaultTo([], this.ancestors)
    },
    visibleBreadcrumbs: function() {
      return this.breadcrumbs.slice(-MAX_VISIBLE_ANCESTORS)
    },
    overflowBreadcrumbs: function() {
      return this.breadcrumbs.slice(0, -MAX_VISIBLE_ANCESTORS)
    }
  },

  methods: {
    /**
     * Handler for breadcrumb navigation
     * @param {String} id
     */
    breadcrumbNavigate: function(id = '') {
      if (!isEmpty(id)) {
        return this.$emit('navigate-breadcrumb', id)
      }
      this.$emit('navigate-breadcrumb')
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme';

.breadcrumb-navigation {
  align-items: center;
  display: flex;
  font-size: 14px;
  font-weight: 400;
  line-height: 32px;
  margin: 0;
  margin-left: 16px;
  white-space: nowrap;
  color: theme.$purple_3;
  overflow: hidden;
  flex: 1;
  min-width: 0;

  .el-dropdown {
    color: theme.$purple_3;
    display: inline-flex;
    flex-shrink: 0;
  }

  .overflow-trigger {
    font-weight: 600;
    letter-spacing: 1px;
  }

  .breadcrumb-menu {
    max-width: 256px;
    .el-dropdown-menu__item {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .breadcrumb-caret {
    flex-shrink: 0;
    margin: 0 6px;
  }
  .collection-name {
    align-items: center;
    color: theme.$purple_3;
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dark-text {
    color: theme.$gray_5;
  }

  .full-path {
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
  }

  .breadcrumb-item {
    color: theme.$purple_3;
    flex-shrink: 0;

    &.clickable {
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .breadcrumb-separator {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
}
</style>
