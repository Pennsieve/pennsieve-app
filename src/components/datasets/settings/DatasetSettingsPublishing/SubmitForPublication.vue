<template>
  <div class="submit-for-publication">
    <bf-button
      class="primary"
      :disabled="!canPublish || datasetLocked || isRequested"
      @click="submitForPublication"
    >
      Request to Publish
      </bf-button>
    <submit-dataset-dialog
      :dialog-visible="isSubmitDatasetDialogVisible"
      :dataset-id="datasetId"
      @close="closeDialog"
    />
  </div>

  <!-- </router-link> -->
</template>

<script>
import { PublicationTabs } from '../../../../utils/constants'
import BfButton from '../../../shared/bf-button/BfButton.vue';
import SubmitDatasetDialog from '../../../Publishing/SubmitDatasetDialog/SubmitDatasetDialog.vue'
import { mapGetters } from 'vuex';
//import ChangelogPopup from '@/components/datasets/settings/DataSettingsPublishing/ChangeloPopup.vue';
export default {
  components: {
    BfButton,
    SubmitDatasetDialog
  },
  props: {
    datasetId: {
      type: String,
      required: true,
    },
    canPublish: {
      type: Boolean,
      required: true
    },
    isRequested: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      isSubmitDatasetDialogVisible: false
    }
  },
  computed: {
    ...mapGetters(['datasetLocked']),

    PublicationTabs: function() {
      return PublicationTabs
    }
  },

  methods: {
    closeDialog: function() {
      this.isSubmitDatasetDialogVisible = false
    },
     /**
      * Open submit for publication dialog
     */
      submitForPublication: function() {
       this.isSubmitDatasetDialogVisible = true
     }
  },
}
</script>
