<template>
  <el-dialog
    class="simple"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        title="Remove relationships"
      />
    </template>

    <dialog-body>
      <template #icon>
        <IconGraph
          class="icon-graph"
          :height="32"
          :width="32"
        />
      </template>

      <template #heading>
        <h2>
          {{ this.relationshipText }}
        </h2>
      </template>

      <p>Deleting relationships cannot be undone.</p>

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
        @click="sendRequest"
      >
        Delete
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { mapGetters } from 'vuex'
import { pathOr, prop } from 'ramda'

import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'

import Request from '../../../../mixins/request'
import EventBus from '../../../../utils/event-bus'
import IconGraph from "../../../icons/IconGraph.vue";

export default {
  components: {
    IconGraph,
    BfButton,
    DialogBody,
    BfDialogHeader
  },

  emits: [
    'update:dialogVisible'
  ],

  mixins: [
    Request
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      tableName: '',
      relationships: []
    }
  },

  computed: {
    ...mapGetters([
      'config'
    ]),
    /**
     * Endpoint for removing relationship instances
     */
    apiUrl: function() {
      const url = pathOr('', ['config', 'conceptsUrl'])(this)
      if (!url) {
        return ''
      }
      const datasetId = this.datasetId
      return `${url}/datasets/${datasetId}/relationships/instances/bulk`
    },
    /**
     * Sum total of relationships
     */
    count: function() {
      return this.relationships.length
    },
    /**
     * Generate text for Dialog Body
     */
    relationshipText: function() {
      if (this.count > 1) {
        return `Delete these ${this.count} Relationships?`
      }
      return 'Delete this Relationship?'
    }
  },

  methods: {
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      const relationshipInstanceIds = this.relationships

      this.sendXhr(this.apiUrl, {
        method: 'DELETE',
        body: { relationshipInstanceIds },
        header: {
          'Authorization': `bearer ${this.userToken}`
        }
      })
      .then(this.handleXhrSuccess.bind(this))
      .catch(this.handleXhrError.bind(this))

      this.closeDialog()
    },
    /**
     * Handles successful response
     */
    handleXhrSuccess: function() {
      const msg = this.count > 1 ? 'Relationships Removed' : 'Relationship Removed'
      EventBus.$emit('toast', {
        detail: {
          type: 'success',
          msg
        }
      })
      EventBus.$emit('refresh-table-data', {
        name: this.tableName,
        count: this.count,
        type: 'Remove'
      })
    },
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.$emit('update:dialogVisible', false)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';
@import '../../../../assets/_icon-item-colors.scss';

.dialog-body {
  text-align: center;

  .icon-graph {
    margin-bottom: 8px;
    color: $purple_2;
  }
}

</style>
