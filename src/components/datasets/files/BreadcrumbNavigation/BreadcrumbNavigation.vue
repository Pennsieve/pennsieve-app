<template>
  <div class="breadcrumb-navigation">
    <template v-if="!ancestors || !fileId">
      Files
    </template>
    <template v-else>
      <el-dropdown
        trigger="click"
        placement="bottom-start"
        :class="isLightBackground && 'dark-text'"
        @command="breadcrumbNavigate"
      >
        <span class="el-dropdown-link button-icon">
          <IconMenu :height="20" :width="20" />
        </span>
        <template #dropdown>
          <el-dropdown-menu
            slot="dropdown"
            class="breadcrumb-menu bf-menu"
            :arrow-offset="0"
          >
            <el-dropdown-item
              v-for="breadcrumb in breadcrumbs"
              :key="breadcrumb.content.id"
              :command="breadcrumb.content.id"
            >
              {{ breadcrumb.content.name }}
            </el-dropdown-item>
            <el-dropdown-item>Files</el-dropdown-item>
          </el-dropdown-menu>
        </template>

      </el-dropdown>

<!--      <span>Files <IconArrowRight-->
<!--        class="breadcrumb-caret"-->
<!--        :height="10"-->
<!--        :width="10"-->
<!--      /> </span>-->
<!--      <span v-for="p in breadcrumbs.slice().reverse()">-->
<!--        {{p.content.name}}-->
<!--        <IconArrowRight-->
<!--          class="breadcrumb-caret"-->
<!--          :height="10"-->
<!--          :width="10"-->
<!--        />-->
<!--      </span>-->


      <span>
        <IconArrowRight
          class="breadcrumb-caret"
          :height="10"
          :width="10"
        />
      </span>
      <span class="collection-name" :class="isLightBackground && 'dark-text'">
        {{ file.content.name }}
      </span>
    </template>
  </div>
</template>

<script>
import { defaultTo, isEmpty } from 'ramda'
import IconMenu from "../../../icons/IconMenu.vue";
import IconArrowRight from "../../../icons/IconArrowRight.vue";

export default {
  name: 'BreadcrumbNavigation',
  components: {IconArrowRight, IconMenu},
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
    /**
     * Reverse ancestors to show in correct order
     * @returns {Array}
     */
    breadcrumbs: function() {
      return defaultTo([], this.ancestors).reverse()
    }
  },

  methods: {
    /**
     * Handler for breadcrumb overflow navigation
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

<style lang="scss">
@import '../../../../assets/_variables.scss';

.breadcrumb-navigation {
  align-items: center;
  display: flex;
  font-size: 18px;
  font-weight: 300;
  line-height: 40px;
  margin: 0;
  margin-left: 16px;
  white-space: nowrap;
  color: $purple_3;

  .el-dropdown {
    color: $purple_3;
    display: inline-flex;
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
    margin: 0 8px;
  }
  .collection-name {
    align-items: center;
    color: $purple_3;
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dark-text {
    color: $gray_5;
  }
}
</style>
