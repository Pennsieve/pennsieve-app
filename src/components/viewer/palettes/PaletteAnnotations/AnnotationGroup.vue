<template>
  <div class="controls-icons">
    <el-tooltip
      placement="top"
      :content="layer.visible === false ? 'Show' : 'Hide'"
      :show-after="300"
    >
      <button @click="onToggleVisibility">
        <IconEyeball
          :height="16"
          :width="16"
          :class="{ 'layer-hidden': layer.visible === false }"
        />
      </button>
    </el-tooltip>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { useAnnotationLayers } from '@/composables/useAnnotationLayers'
import Request from '../../../../mixins/request'
import IconEyeball from "../../../icons/IconEyeball.vue";

export default {
  name: 'AnnotationGroup',
  components: {IconEyeball},
  mixins: [
    Request
  ],

  props: {
    layer: {
      type: Object,
      default: function() {
        return {}
      }
    },
    hide_title: {
      type: Boolean,
      default: true
    },
    orig_label: {
      type: String,
      default: ""
    },
    can_crud_annotation: {
      type: Boolean,
      default: false
    }
  },

  setup() {
    const { updateLayerVisibility } = useAnnotationLayers()
    return {
      updateLayerVisibility
    }
  },

  data: function() {
    return {
      newLabel: ''
    }
  },

  computed: {
    ...mapState('viewerModule', ['activeViewer']),
    ...mapState([
      'config',
      'bulkEditingChannels'
    ]),
  },

  methods: {
    onToggleVisibility: function(event) {
      event.preventDefault()
      event.stopPropagation()

      // Toggle the layer visibility
      const newVisibility = !(this.layer.visible === false ? false : true)
      console.log(`Toggling layer ${this.layer.id} visibility to:`, newVisibility)

      this.updateLayerVisibility(this.layer.id, newVisibility)

      // Also emit an event to trigger canvas re-render
      this.$emit('visibility-changed', {
        layerId: this.layer.id,
        visible: newVisibility
      })
    },

    // Method for the bulk toggle in PaletteAnnotations
    toggleLayer: function(visible) {
      console.log(`[AnnotationGroup] Bulk toggling layer ${this.layer.id} (${this.layer.name}) visibility to:`, visible)

      try {
        this.updateLayerVisibility(this.layer.id, visible)
        console.log(`[AnnotationGroup] Successfully updated layer ${this.layer.id} visibility`)

        this.$emit('visibility-changed', {
          layerId: this.layer.id,
          visible: visible
        })
      } catch (error) {
        console.error(`[AnnotationGroup] Error updating layer ${this.layer.id} visibility:`, error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.controls-icons {
  padding-right: 8px;
}

// Add visual indication for hidden layers
.layer-hidden {
  opacity: 0.4;
  color: #9b9b9b !important;
}

.bf-channel {
  background: #F7F7F7;
  border-bottom: 1px solid theme.$gray_6;
  box-sizing: border-box;
  display: flex;
  padding: 3px 8px 3px 16px;
  &:hover {
    background: #fff;
  }
  &:not(.visible) {
    .channel-info {
      opacity: .4
    }
    .svg-icon {
      color: #9b9b9b;
    }
  }
}

.channel-info {
  color: theme.$gray_3;
  flex: 1;
}
.channel-controls {
  align-items: center;
  display: none;
  .bf-channel:hover & {
    display: flex;
  }
  .bf-channel.editing & {
    display: none;
  }

  button {
    color: #000;
  }
}

h2 {
  font-size: 13px;
  margin-bottom: 2px;
}
.selected {
  color: theme.$purple_2
}
button {
  &:hover, &:focus {
    color: theme.$app-primary-color;
  }
}
</style>

<style lang="scss">
.bf-channel {
  .channel-input-wrapper {
    width: 164px;
  }
  .el-input__inner {
    height: 18px !important;
    font-size: 12px;
    padding: 0 4px;
  }
  .revert {
    margin-left: 8px;
  }
  .label-group {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .filter-present {
    margin-left: 5px;
  }
}
</style>