<template>
  <el-dropdown
    trigger="click"
    placement="bottom-start"
    @command="$emit('update-status-filter', $event)"
    @visible-change="isMenuOpen = $event"
  >
    <button class="dataset-filter-dropdown el-dropdown-link">
      <span class="el-dropdown-text-link">
        Show {{ statusLabel }}
      </span>
      <IconArrowUp
        class="ml-8"
        name="icon-arrow-up"
        :class="[ menuArrowDir === 'down' ? 'svg-flip' : '' ]"
        :height="10"
        :width="10"
      />
    </button>

    <template #dropdown>
      <el-dropdown-menu
        slot="dropdown"
        class="bf-menu"
      >
        <el-dropdown-item
          v-for="option in statusOptions"
          :key="option"
          class="icon-item"
          :command="option"
        >
          {{ option }}
          <IconCheck
            v-if="statusFilter === option"
            class="item-icon-check"
            :width="20"
            :height="20"
          />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>


  </el-dropdown>
</template>

<script>
import IconArrowUp from "../../../icons/IconArrowUp.vue";
import IconCheck from "../../../icons/IconCheck.vue";
export default {
  name: 'ManifestStatusMenu',
  components: {IconCheck, IconArrowUp},
  props: {
    statusFilter: {
      type: String,
      default: "All"
    },
    statusOptions: {
      type: Array,
      default: () => {
        return [
          "All",
          "In Progress",
          "Failed",
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
    statusLabel: function() {
      switch (this.statusFilter) {
        case "All":
          return "All Files"
        default:
          return this.statusFilter
      }
      return "hello"
    }
  }
}
</script>
