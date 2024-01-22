<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        title="Confirm Deletion"
      />
    </template>


    <dialog-body>
      <div class="warning-wrap">
        <IconWarningCircle
          :height="32"
          :width="32"
        />
        <h4 class="delete-title">
          Deleting this Relationship Type will remove the links between records in your graph.
        </h4>
        <div class="warning-message">
          Warning: This cannot be undone
        </div>
      </div>
      <el-form
        ref="deleteDatasetForm"
        v-loading="isLoadingInstances"
        @submit.native.prevent="onFormSubmit"
      >
        <el-form-item prop="checkBoxes">
          <el-checkbox-group v-model="form.checkBoxes">
            <el-checkbox
              class="step-1"
              name="type"
            >
              <span v-if="!isLoadingInstances">
                {{ relationshipInstancesCount }} Relationships will be deleted
              </span>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        class="red"
        :disabled="disabled"
        @click="onFormSubmit"
      >
        Delete
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { pathOr, propOr } from 'ramda'
import { mapState } from 'vuex'

import BfButton from '../../../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../../shared/dialog-body/DialogBody.vue'

import Request from '../../../../../mixins/request'
import IconWarningCircle from "../../../../icons/IconWarningCircle.vue";

export default {
  name: 'DeleteRelationshipTypeDialog',

  components: {
    IconWarningCircle,
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    Request
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    relationshipTypeEdit: {
      type: Object,
      default: () => {
        return {}
      }
    },
    url: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      form: {
        checkBoxes: []
      },
      relationshipInstancesCount: 0,
      isLoadingInstances: true
    }
  },

  computed: {
    ...mapState([
      'userToken'
    ]),

    disabled: function() {
      return this.form.checkBoxes.length === 0
    },

    relationshipInstancesUrl: function() {
      const relationshipId = propOr('', 'id', this.relationshipTypeEdit)
      return `${this.url}/${relationshipId}/instances`
    }
  },

  watch: {
    dialogVisible: {
      handler: function(val) {
        if (val) {
          this.getRelationshipInstances()
        }
      }
    }
  },

  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.$emit('update:dialogVisible', false)
      this.$emit('update:relationshipTypeEdit', {})
      this.form.checkBoxes = []
    },

    /**
     * Handler for form submit and validation
     */
    onFormSubmit: function() {
      console.log("123" + this.relationshipTypeEdit.id)
      this.deleteRelationshipType()
    },

    /**
     * Request all relationship instances of the current relationship type
     */
    getRelationshipInstances: function() {
      console.log(this.relationshipTypeEdit.id)
      this.sendXhr(this.relationshipInstancesUrl, {
        header: {
          'Authorization': `bearer ${this.userToken}`
        },
      })
      .then(response => {
        this.relationshipInstancesCount = response.length
        this.isLoadingInstances = false
      })
      .catch(this.handleXhrError)
    },

    /**
     * Delete relationship type and all associated relationships
     */
    deleteRelationshipType: function() {
      console.log(this.relationshipTypeEdit)
      const relationshipId = propOr('', 'id', this.relationshipTypeEdit)
      const url = `${this.url}/${relationshipId}`

      this.sendXhr(url, {
        method: 'DELETE',
        header: {
          'Authorization': `bearer ${this.userToken}`
        },
      })
      .then(response => {
        this.$emit('remove-relationship-type', this.relationshipTypeEdit)
        // this.closeDialog()
      })
      .catch(error => {
        this.handleXhrError(error)
        // this.closeDialog()
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../../assets/_variables.scss';

.el-form {
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.delete-title {
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
  color: $red_1;
}

.warning-wrap {
  text-align: center;
  margin-bottom: 24px;
}

.warning-message {
  color: $red_1;
}
</style>
