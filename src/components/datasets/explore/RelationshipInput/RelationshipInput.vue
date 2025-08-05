<template>
  <div
    class="relationship-input"
    :class="[ canCreate ? 'can-create' : '' ]"
  >
    <el-select
      ref="menu"
      v-model="selectedValue"
      filterable
      :allow-create="canCreate"
      :placeholder="placeholder"
      default-first-option
      no-data-text="Start typing to add a new relationship"
      popper-class="bf-menu relationship-input-options"
      @visible-change="formatDisplayValue"
      @change="$emit('update:modelValue', $event)"
    >
      <el-option-group label="Existing Relationships">
        <el-option
          v-for="option in options"
          :key="option.id"
          class="filtered-field bf-menu-item"
          :label="option.displayName"
          :value="option.name"
        >
          <span class="option-label">
            {{ option.displayName }}
          </span>

          <IconArrowUp
            v-if="showDirection"
            class="icon-arrow"
            :class="[ flipIconArrow(option) ? 'flip-icon-arrow' : '']"
            :width="24"
            :height="24"
          />
        </el-option>
      </el-option-group>
    </el-select>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { pathOr, propOr } from 'ramda'
import IconArrowUp from "../../../icons/IconArrowUp.vue";

export default {
  name: 'RelationshipInput',
  components: {IconArrowUp},
  props: {
    options: {
      type: Array,
      default: () => []
    },
    placeholder: {
      type: String,
      default: 'Provide New or Select Existing Relationship Type'
    },
    isCreating: {
      type: Boolean,
      default: false
    },
    canCreate: {
      type: Boolean,
      default: true
    },
    modelValue: {
      type: String
    },
    showDirection: {
      type: Boolean,
      default: false
    },
    inverseDirection: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      selectedValue: ''
    }
  },

  computed: {
    ...mapGetters([
      'getRelationshipTypeDisplayName'
    ]),
  },

  watch: {
    modelValue: function(newValue) {
      if (newValue !== this.selectedValue) {
        this.selectedValue = newValue
      }

      const relationshipIndex = this.options.findIndex(option => option.name === this.selectedValue)
      const relationship = propOr({}, relationshipIndex, this.options)
      const modelId = pathOr('', ['params', 'conceptId'], this.$route)

      if (relationship.to === modelId) {
        this.$emit('update:inverseDirection', true)
      } else {
        this.$emit('update:inverseDirection', false)
      }

      this.formatDisplayValue()
    }
  },

  mounted() {
    // Watch el-select's computed property, showNewOption
    this.$watch('$refs.menu.showNewOption', (newValue) => {
      this.$emit('update:isCreating', newValue)
    })
  },

  methods: {
    /**
     * Format display name for relationship and set it as the `selectedLabel`
     */
    formatDisplayValue: function() {
      this.$nextTick(() => {
        const displayName = this.getRelationshipTypeDisplayName(this.modelValue)
        if (displayName) {
          this.$refs.menu.selectedLabel = this.getRelationshipTypeDisplayName(this.modelValue)
        }
      })
    },

    /**
     * Compute if arrow should change directions
     * @param {Object} relationship
     */
    flipIconArrow: function(relationship) {
      const modelId = pathOr('', ['params', 'conceptId'], this.$route)
      if (relationship.to === modelId) {
        return true
      }

      return false
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';
@use '../../../../styles/element/select';

.el-select {
  width: 100%;
}

.relationship-input-options {
  .el-select-dropdown__item:not(.filtered-field) {
    align-items: center;
    color: theme.$app-primary-color;
    display: flex;
    padding: 16px;
    text-decoration: underline;

    &:before {
      content: 'Create "'
    }
    &:after {
      content: '"'
    }

    &.selected {
      color: #fff
    }
  }

  .option-label {
    display: inline-block;
  }

  .icon-arrow {
    color: #BDBDBD;
  }

  .flip-icon-arrow {
    transform: rotate(180deg);
  }
}

.relationship-input {
  min-width:100%;
}

.relationship-input.can-create .el-select__caret {
  display: none;
}

</style>