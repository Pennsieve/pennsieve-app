<template>
  <div class="dataset-list-controls">
    <div class="action-wrap">
      <div class="dropdown-wrapper">
        <button 
          class="dropdown-button"
          @click="isPageSizeMenuOpen = !isPageSizeMenuOpen"
        >
          <span class="dropdown-text">
            {{ listControlName }} per page {{ pageSize }}
          </span>
          <IconArrowDown
            :height="10"
            :width="10"
            :class="[isPageSizeMenuOpen ? 'rotated' : '']"
          />
        </button>
        
        <div v-if="isPageSizeMenuOpen" class="dropdown-menu">
          <div
            v-for="option in pageSizeOptions"
            :key="option"
            class="dropdown-item"
            @click="setPageSize(option)"
          >
            {{ option }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import IconArrowDown from '../../icons/IconArrowDown.vue'

export default {
  name: 'DatasetListControls',

  components: {
    IconArrowDown
  },

  props: {
    total: {
      type: Number,
      default: 0
    },
    pageSize: {
      type: Number,
      default: 25
    },
    pageSizeOptions: {
      type: Array,
      default: () => [10, 25, 50, 100]
    },
    listControlName: {
      type: String,
      default: 'datasets'
    }
  },

  data() {
    return {
      isPageSizeMenuOpen: false
    }
  },

  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.handleClickOutside)
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  },

  methods: {
    setPageSize(pageSize) {
      this.$emit('update:pageSize', pageSize)
      this.isPageSizeMenuOpen = false
      this.$nextTick(() => {
        this.$emit('set-list-options', {
          pageSize: pageSize
        })
      })
    },

    handleClickOutside(event) {
      if (!this.$el.contains(event.target)) {
        this.isPageSizeMenuOpen = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../styles/_theme.scss';

.dataset-list-controls {
  align-items: center;
  display: flex;
  justify-content: flex-start;
}

.action-wrap {
  align-items: center;
  display: flex;
  min-height: 24px;
}

.dropdown-wrapper {
  position: relative;
  margin-right: 24px;
}

.dropdown-button {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  font-size: 14px;
  color: theme.$gray_6;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  .dropdown-text {
    margin-right: 8px;
  }

  svg {
    transition: transform 0.2s ease;
    
    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 2px;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: theme.$gray_6;
  transition: background 0.2s ease;

  &:hover {
    background: theme.$gray_1;
  }

  &:first-child {
    border-radius: 4px 4px 0 0;
  }

  &:last-child {
    border-radius: 0 0 4px 4px;
  }
}
</style>