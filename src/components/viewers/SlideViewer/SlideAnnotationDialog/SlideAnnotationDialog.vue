<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="close"
    @closed="onClosed"
    @open="onOpen"
  >
    <template #header>
      <bf-dialog-header
        :title="ctaCopy"
      />
    </template>

    <dialog-body>
      <el-form
        ref="form"
        :model="form"
        :rules="rules"
      >
        <el-form-item
          class="mb-16"
          prop="layer"
        >
          <el-select
            v-model="form.layer"
            value-key="id"
            placeholder="Select a layer"
          >
            <span
              slot="prefix"
              class="layer-color"
              :style="{ background: form.layer.color }"
            />
            <el-option
              v-for="layer in viewerAnnotations"
              :key="layer.id"
              :label="layer.name"
              :value="layer"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            autofocus
            :rows="8"
            placeholder="Add a description."
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="$emit('cancel')"
      >
        Cancel
      </bf-button>
      <bf-button
        :processing="isProcessing"
        @click="validateForm"
      >
        {{ ctaCopy }}
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import {
  mapState
} from 'vuex'
import {
  find,
  head,
  pathOr,
  propEq,
  propOr
} from 'ramda'

import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'

import Autofocus from '../../../../mixins/auto-focus'

export default {
  name: 'SlideAnnotationDialog',

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  mixins: [
    Autofocus
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    annotation: {
      type: Object,
      default: () => {
        return {}
      }
    },
    isCreating: {
      type: Boolean,
      default: false
    }
  },

  data: function () {
    return {
      form: {
        layer: {},
        description: ''
      },
      rules: {
        layer: [
          { required: true, message: 'Layer is required', trigger: 'false' },
        ],
        description: [
          { required: true, message: 'Description is required', trigger: 'false' },
        ]
      },
      isProcessing: false,
      isSubmitted: false
    }
  },

  computed: {
    ...mapState('viewerModule', [
      'viewerAnnotations'
    ]),

    /**
     * Compute CTA copy
     * @returns {String}
     */
    ctaCopy: function () {
      return this.isCreating
        ? 'Create annotation'
        : 'Edit annotation'
    }
  },

  methods: {
    /**
     * Emit event to update the synced property
     */
    close: function() {
      if (this.isSubmitted) {
        this.$emit('update:visible', false)
        this.$emit('update:isCreating', false)
        this.$emit('update:isSubmitted', false)
        this.$emit('update:annotation', {})
      } else {
        this.$emit('cancel')
      }
    },

    /**
     * Callback after the dialog has closed
     * Reset dialog
     */
    onClosed: function() {
      this.isProcessing = false
      this.$refs.form.resetFields()
    },

    /**
     * Set default values on open
     */
    onOpen: function() {
      this.isSubmitted = false

      this.autoFocus()

      if (this.isCreating) {
        this.setDefaultLayer()
      } else {
        this.setAnnotation()
      }
    },

    /**
     * Set first layer in list as the default
     */
    setDefaultLayer: function() {
      this.form.layer = head(this.viewerAnnotations)
    },

    /**
     * Set the annotation the user is editing
     */
    setAnnotation: function() {
      const description = propOr('', 'description', this.annotation)
      this.form.description = description

      const layerId = propOr('', 'layer_id', this.annotation)
      if (layerId) {
        const layer = find(propEq('id', layerId), this.viewerAnnotations)
        this.form.layer = layer
      }
    },

    /**
     * Validate form, and then submit if it is valid
     */
    validateForm: function (){
      this.$refs.form
        .validate((valid) => {
          if (!valid) {
            return
          }
          this.submitForm()
        })
    },

    /**
     * Submit form and emit event
     */
    submitForm: function() {
      this.isProcessing = true
      this.isSubmitted = true

      const newLayerId = pathOr('', ['layer', 'id'], this.form)
      const description = propOr('', 'description', this.form)

      const annotationInfo = {
        newLayerId,
        description
      }
      const annotation = Object.assign({}, this.annotation, annotationInfo)

      const eventName = this.isCreating
        ? 'create-annotation'
        : 'edit-annotation'
      this.$emit(eventName, annotation)
    }
  }
}
</script>

<style lang="scss" scoped>
.el-select {
  width: 100%;
  .el-input__inner {
    padding-left: 16px;
  }
  .el-input__prefix {
    left: 0;
  }
}
.layer-color {
  border-radius: 4px 0 0 4px;
  height: 100%;
  position: absolute;
  width: 5px;
}
.bf-dialog-header-title {
  text-transform: capitalize;
}
</style>
