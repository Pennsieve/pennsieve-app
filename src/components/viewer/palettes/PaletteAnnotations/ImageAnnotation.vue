<template>
  <div
    :id="annotation.id"
    :class="['ts-annotation',
                isSelected ? 'selected' : ''
              ]"
    @click="onAnnotationSelect"
  >
    <div class="annotation-info">
      <div>{{ annotation.description }}</div>
    </div>
    <div class="annotation-controls">
      <el-tooltip
        placement="top"
        content="Edit"
        :open-delay="300"
      >
        <button
          class="mr-8"
          @click="onEditChannel"
        >
          <IconPencil
            :height="16"
            :width="16"
          />
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top"
        content="Delete"
        :open-delay="300"
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
import { mapState, mapActions } from 'vuex'
import EventBus from '../../../../utils/event-bus'
import Request from '../../../../mixins/request'
import IconPencil from "../../../icons/IconPencil.vue";
import IconDelete from "../../../icons/IconDelete.vue";

export default {
  name: 'ImageAnnotation',
  components: {IconDelete, IconPencil},
  mixins: [
    Request
  ],

  props: {
    annotation: {
      type: Object,
      default: function() {
        return {}
      }
    }
  },

  data: function() {
    return {
    }
  },

  computed: {
    ...mapState('viewerModule', ['activeViewer', 'activeAnnotation']),
    ...mapState([
      'config',
      'userToken',
    ]),
    isSelected: function() {
      return this.annotation.selected
    },
  },

  methods: {

    deleteAnnotation: function(evt) {
      const forceDelete = evt.metaKey
      if (forceDelete){
        EventBus.$emit('active-viewer-action', {
          method: 'deleteAnnotation',
          payload: this.annotation
        })
      } else {
        EventBus.$emit('active-viewer-action', {
          method: 'confirmDeleteAnnotation',
          payload: {
            annotation: this.annotation,
            withDiscussions: true,
          }
        })
      }
    },
    /**
     * When click on Annotation,
     * Jump to annotation in viewer
     */
    onAnnotationSelect: function() {
      this.$store.dispatch('viewerModule/setActiveAnnotation', this.annotation)

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
@import '../../../../assets/_variables.scss';

.ts-annotation {
  background: $gray_0;
  border-bottom: 1px solid $gray_2;
  box-sizing: border-box;
  display: flex;
  padding: 3px 8px 3px 16px;
  & .selected {
    background-color: $purple_tint;
  }
  &:hover {
    background: white;
  }
  &:not(.visible) {
    .channel-info {
      opacity: .4
    }
    .svg-icon {
      color: $gray_4;
    }
  }

}

.annotation-info {
  //color: $gray_4;
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
  color: $purple_1
}
button {
  &:hover, &:focus {
    color: $app-primary-color;
  }
}
</style>

