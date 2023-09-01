<template>
  <el-dropdown
    trigger="click"
    placement="bottom-start"
    @command="$emit('update-page-size', $event)"
    @visible-change="isMenuOpen = $event"
  >
    <button class="dataset-filter-dropdown el-dropdown-link">
      <span class="el-dropdown-text-link">
        {{ paginationItemLabel }} per page {{ pageSize }}
      </span>

      <IconArrowUp
        class="ml-8 arrow-style"
        :class="[ menuArrowDir === 'down' ? 'svg-flip' : '' ]"
        color="black"
      />

    </button>
    <template #dropdown>
      <el-dropdown-menu
        slot="dropdown"
        class="bf-menu"
      >
        <el-dropdown-item
          v-for="option in pageSizeOptions"
          :key="option"
          class="icon-item"
          :command="option"
        >
          {{ option }}
          <IconCheck
            v-if="pageSize === option"
            icon="icon-check"
            class="item-icon-check"
            :width="20"
            :height="20"
            color="black"
          />

        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script>

import IconArrowUp from "../../icons/IconArrowUp.vue"
import IconCheck from "../../icons/IconCheck.vue"


export default {
  name: 'PaginationPageMenu',

  components: {
    IconArrowUp,
    IconCheck
  },

  props: {
    paginationItemLabel: {
      type: String,
      default: 'Items'
    },
    pageSize: {
      type: Number,
      default: 25
    },
    pageSizeOptions: {
      type: Array,
      default: () => {
        return [
          25,
          50,
          100
        ]
      }
    }
  },

  data: function() {
    return {
      isMenuOpen: false
    }
  },

  computed: {
    /**
     * Compute dataset filter arrow direction
     * @returns {String}
     */
    menuArrowDir: function() {
      return this.isMenuOpen ? 'up' : 'down'
    },
  }
}
</script>
