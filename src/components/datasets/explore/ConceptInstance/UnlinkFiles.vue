<template>
  <div>
    <el-dialog
      class="simple"
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header>
        <bf-dialog-header
          title="Remove Relationships"
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

        <p>Deleting file links cannot be undone.</p>

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

  </div>
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
import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr} from "@/mixins/request/request_composable";

export default {
  components: {
    IconGraph,
    BfButton,
    DialogBody,
    BfDialogHeader
  },

  mixins: [
    Request
  ],

  data() {
    return {
      tableName: '',
      relationships: []
    }
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    sourceRecordId: {
      type: String,
      default: ''
    },
    data: {
      type: Object,
      default: () => { return {
          relationships: [],
          datasetId: ''
        }
      }
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
      const datasetId = this.data.datasetId
      const relationshipInstanceIds = this.data.relationships
      return `${url}/datasets/${datasetId}/proxy/package/instances/bulk`

    },
    /**
     * Sum total of relationships
     */
    count: function() {
      return this.data && this.data.relationships ? this.data.relationships.length : 0
    },
    /**
     * Generate text for Dialog Body
     */
    relationshipText: function() {
      if (this.count > 1) {
        return `Delete these ${this.count} Links?`
      }
      return 'Delete this Link?'
    }
  },

  methods: {
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      useGetToken()
        .then(token => {
          useSendXhr(this.apiUrl, {
            method: 'DELETE',
            body: {
              sourceRecordId: this.sourceRecordId,
              proxyInstanceIds: this.data.relationships
            },
            header: {
              'Authorization': `bearer ${token}`
            }
          })
            .then(this.handleXhrSuccess.bind(this))
            .catch(this.handleXhrError.bind(this))
        }).finally(() => this.closeDialog())

    },
    /**
     * Handles successful response
     */
    handleXhrSuccess: function() {
      const msg = this.count > 1 ? 'Links Removed' : 'Link Removed'
      EventBus.$emit('toast', {
        detail: {
          type: 'success',
          msg
        }
      })
      EventBus.$emit('refresh-table-data', {
        name: this.data.tableName,
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
@use '../../../../styles/theme';
@use '../../../../styles/icon-item-colors';

.dialog-body {
  text-align: center;

  .icon-graph {
    margin-bottom: 8px;
  }
}

</style>
