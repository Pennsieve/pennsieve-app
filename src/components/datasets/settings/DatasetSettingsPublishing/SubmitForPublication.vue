<template>
  <div class="submit-for-publication">
    <bf-button
      class="primary"
      :disabled="!canPublish || datasetLocked || isRequested"
      @click="openSubmitDialog"
    >
      Submit
    </bf-button>
    <submit-dataset-dialog
      v-model:visible="isSubmitDatasetDialogVisible"
      :dataset-id="datasetId"
      :publication-type="publicationType"
    />
  </div>
</template>

<script>
import { PublicationType } from '../../../../utils/constants'
import BfButton from '../../../shared/bf-button/BfButton.vue';
import SubmitDatasetDialog from '../../../Publishing/SubmitDatasetDialog/SubmitDatasetDialog.vue'
import { mapGetters } from 'vuex';

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
    },
    publicationType: {
      type: String,
      default: PublicationType.PUBLICATION
    }
  },

  data() {
    return {
      isSubmitDatasetDialogVisible: false
    }
  },
  computed: {
    ...mapGetters(['datasetLocked']),
  },

  methods: {
    openSubmitDialog: function() {
      this.isSubmitDatasetDialogVisible = true
    }
  },
}
</script>
