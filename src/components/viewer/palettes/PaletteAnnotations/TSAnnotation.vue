<template>
  <div
    :id="annotation.id"
    :class="['ts-annotation',
                isSelected ? 'selected' : ''
              ]"
    @click="onAnnotationSelect"
  >
    <div class="annotation-info">
      <div>{{ annotation.label }}</div>
      <div>{{ startTime }}</div>
    </div>
    <div class="annotation-controls">
<!--      <el-tooltip-->
<!--        placement="top"-->
<!--        content="Edit"-->
<!--        :show-after="300"-->
<!--      >-->
<!--        <button-->
<!--          class="mr-8"-->
<!--          @click="onEditChannel"-->
<!--        >-->
<!--          <IconPencil-->
<!--            :height="16"-->
<!--            :width="16"-->
<!--          />-->
<!--        </button>-->
<!--      </el-tooltip>-->
      <el-tooltip
        placement="top"
        content="Delete"
        :show-after="300"
      >
        <button
          class="mr-8"
          @click="deleteAnnotation"
        >
          <IconDelete
            :height="16"
            :width="16"
          />
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { useViewerInstance } from '@/composables/useViewerInstance'
import EventBus from '../../../../utils/event-bus'
import Request from '../../../../mixins/request'
import IconPencil from "../../../icons/IconPencil.vue"
import IconDelete from "../../../icons/IconDelete.vue"

export default {
  name: 'TsAnnotation',

  components: {
    IconDelete,
    IconPencil
  },

  mixins: [Request],

  props: {
    annotation: {
      type: Object,
      default: function() {
        return {}
      }
    }
  },

  setup() {
    // Setup viewer controls (new 1.1.0 API)
    const viewerControls = useViewerInstance()

    return {
      viewerControls
    }
  },

  data: function() {
    return {}
  },

  computed: {
    // Keep activeViewer from Vuex if not migrated yet, remove activeAnnotation since it's now from Pinia
    ...mapState('viewerModule', ['activeViewer']),
    ...mapState(['config']),

    isSelected: function() {
      // Check the annotation's selected property
      return this.annotation.selected || false
    },

    startTime: function() {
      return this.getUTCDateString(this.annotation.start) + ' ' + this.getUTCTimeString(this.annotation.start)
    }
  },

  methods: {
    onEditChannel: function() {
      EventBus.$emit('active-viewer-action', {
        method: 'openEditAnnotationDialog',
        payload: this.annotation
      })
    },

    deleteAnnotation: function(evt) {
      const forceDelete = evt.metaKey
      if (forceDelete) {
        EventBus.$emit('active-viewer-action', {
          method: 'deleteAnnotation',
          payload: this.annotation
        })
      } else {
        EventBus.$emit('active-viewer-action', {
          method: 'confirmDeleteAnnotation',
          payload: this.annotation
        })
      }
    },

    getUTCDateString: function(d) {
      if (d > 0) {
        d = new Date(d / 1000)
        return d.toDateString()
      } else {
        return 'unknown'
      }
    },

    getUTCTimeString: function(d) {
      if (d > 0) {
        d = d / 1000
        d = new Date(d)
        return (
          ('0' + d.getUTCHours()).slice(-2) + ':' +
          ('0' + d.getUTCMinutes()).slice(-2) + ':' +
          ('0' + d.getUTCSeconds()).slice(-2)
        )
      }
    },

    /**
     * When click on Annotation,
     * Jump to annotation in viewer
     */
    onAnnotationSelect: function() {
      // Use viewer controls API to select annotation
      this.viewerControls.selectAnnotation(this.annotation.id)

      EventBus.$emit('active-viewer-action', {
        method: 'selectAnnotation',
        payload: {
          annotation: this.annotation
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.ts-annotation {
  background: theme.$white;
  border-bottom: 1px solid theme.$gray_2;
  box-sizing: border-box;
  display: flex;
  padding: 3px 8px 3px 16px;
  color: theme.$purple_2;

  &.selected {
    background-color: theme.$purple_tint;
  }

  &:hover {
    background: theme.$gray_0;
  }

  &:not(.visible) {
    .channel-info {
      opacity: .4
    }

    .svg-icon {
      color: theme.$gray_4;
    }
  }
}

.annotation-info {
  flex: 1;
}

.annotation-controls {
  align-items: center;
  display: none;

  .ts-annotation:hover & {
    display: flex;
  }

  .ts-annotation.editing & {
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
  color: theme.$purple_3
}

button {
  &:hover, &:focus {
    color: theme.$app-primary-color;
  }
}
</style>