<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        slot="title"
        title="Confirmation required"
      />
    </template>

    <dialog-body>
      <div class="warning-wrap">
        <IconWarningCircle
          :height="32"
          :width="32"
        />
        <h4 class="delete-dataset-title">
          {{ actionMessage }}
        </h4>
        <div class="info-message" v-if="infoMessage !== ''">
          {{infoMessage}}
        </div>
        <div class="warning-message" v-if="warningMessage !== ''">
          {{warningMessage}}
        </div>
      </div>
      <el-form
        ref="confirmationForm"
        @submit.native.prevent="onFormSubmit"
      >
        <el-form-item prop="checkBoxes">
          <el-checkbox-group
            v-model="form.checkBoxes"
            @change="isChecked"
          >
            <template v-for="(item, key) in acknowledgements">
              <el-checkbox
                 class="step-1"
                 :label=item
                 name="type"
              />
            </template>

          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        {{cancelActionLabel}}
      </bf-button>
      <bf-button v-if="infoMessage !== ''"
                 class="blue"
                 :disabled="disableConfirmation"
                 @click="onFormSubmit"
      >
        {{confirmActionLabel}}
      </bf-button>
      <bf-button v-if="warningMessage !== ''"
                 class="red"
                 :disabled="disableConfirmation"
                 @click="onFormSubmit"
      >
        {{confirmActionLabel}}
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { mapState } from 'vuex'

import BfButton from '../bf-button/BfButton.vue'
import BfDialogHeader from '../bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../dialog-body/DialogBody.vue'
import IconWarningCircle from "../../icons/IconWarningCircle.vue";

export default {
  name: 'ConfirmationDialog',

  components: {
    IconWarningCircle,
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    action: {
      type: String,
      required: true
    },
    actionMessage: {
      type: String,
      required: true
    },
    resource: {
      type: Object,
      required: true
    },
    infoMessage: {
      type: String,
      default: ''
    },
    warningMessage: {
      type: String,
      default: ''
    },
    acknowledgements: {
      type: Array,
      default: () => []
    },
    confirmActionLabel: {
      type: String,
      default: "OK"
    },
    cancelActionLabel: {
      type: String,
      default: "Cancel"
    },
  },

  mixins: [
  ],

  computed: {
    ...mapState([]),

    /**
     * Compute rules for checkboxes based on if the dataset has been published
     * @returns {Object}
     */
    rules: function() {
      const checkBoxCount = this.confirmations.length

      return {
        checkBoxes: [
          { type: 'array', required: true, message: 'Please select both boxes', trigger: 'false', len: checkBoxCount },
        ]
      }
    },
    disableConfirmation: function() {
      return this.acknowledgements.length !== this.form.checkBoxes.length
    }
  },

  data() {
    return {
      form: {
        checkBoxes: [],
      },
    }
  },

  methods: {
    /**
     * Handles checkbox group
     */
    isChecked: function(val) {
      const checkBoxCount = this.confirmations.length

      this.disabled = val.length != checkBoxCount
    },
    /**
     * Handler for form submit and validation
     */
    onFormSubmit: function() {
      this.$emit("confirmed", {action: this.action, resource: this.resource})
      this.closeDialog()
    },
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.form.checkBoxes = []
      this.disabled = true
      this.$emit("close", {})
    },
  }
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables';

.el-form {
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.delete-dataset-title {
  margin-top: 0;
}

.el-checkbox-group {
  line-height: 32px;
  width: min-content;
  max-width: 476px;
  overflow-x: scroll;
}

.el-checkbox {
  line-height: 0;
}

.svg-icon {
  color: $info-color;
}

.warning-wrap {
  text-align: center;
  margin-bottom: 24px;
}

.info-message {
  color: $purple_1;
}

.warning-message {
  color: $red_1;
}

.el-form-item {
  // margin-left: 45px;
}

.step-2 {
  margin-left: 0;
}
</style>
