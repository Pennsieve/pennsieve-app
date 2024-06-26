<template>
  <el-dialog
    class="simple"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="close"
    @closed="onClosed"
  >
    <template #header>
      <bf-dialog-header />
    </template>

    <dialog-body>
      <IconWarningCircle
        class="mb-16"
        :height="32"
        :width="32"
        color="#e94b4b"
      />
      <h2>Delete annotation?</h2>
      <template v-if="deleteAnnotation.withDiscussions">
        <p>
          Deleting this annotation will also remove any associated discussions and cannot be undone.
        </p>
        <p>
          Are you sure you would like to remove this annotation?
        </p>
      </template>
      <p v-else>
        {{ annotationDescription }}
      </p>
      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          :processing="isProcessing"
          @click="$emit('delete')"
        >
          {{ btnDeleteCopy }}
        </bf-button>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
import {
  pathOr
} from 'ramda'

import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import IconWarningCircle from "../../../icons/IconWarningCircle.vue";

export default {
  name: 'SlideAnnotationDeleteDialog',

  components: {
    IconWarningCircle,
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    deleteAnnotation: {
      type: Object,
      default: () => {
        return {
          annotation: {},
          withDiscussions: false
        }
      }
    }
  },

  data: function () {
    return {
      isProcessing: false
    }
  },

  computed: {
    /**
     * Compute the annotation's name
     * @returns {String}
     */
    annotationDescription: function() {
      return pathOr('', ['annotation', 'description'], this.deleteAnnotation)
    },

    /**
     * Compute copy for the delete button
     * @returns {String}
     */
    btnDeleteCopy: function (){
      return this.deleteAnnotation.withDiscussions
        ? `Yes, I'm sure`
        : 'Delete'
    }
  },

  methods: {
    /**
     * Emit event to update the synced property
     */
    close: function() {
      this.$emit('cancel')
    },

    /**
     * Callback after the dialog has closed
     * Reset dialog
     */
    onClosed: function() {
      this.isProcessing = false
      this.$emit('update:annotation', {
        annotation: {},
        withDiscussions: false
      })
    }
  }
}
</script>

<style lang="scss" scoped>

h2 {
  color: #000;
  font-size: 14px;
  list-style: 16px;
  margin: 0 0 8px;
}
</style>
