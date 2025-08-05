<template>
  <div class="montage-error-dialog">
    <el-dialog
      class="simple"
      :model-value="isOpen"
      :show-close="true"
      @close="onClose"
    >
      <dialog-body>
        <h2 slot="heading">
          <IconWarningCircle :height="32" :width="32" />
          Something went wrong
        </h2>

        <p>
          We were unable to apply that montage.  Make sure your channel names match standard schemes.
          <a
            href="https://docs.pennsieve.io/docs/timeseries-viewer"
            target="_blank"
          >
            Learn More
          </a>
        </p>
        <p v-if="channelNames.length">
          {{ channelNames }}
        </p>

        <div class="dialog-simple-buttons">
          <bf-button @click="onClose">
            OK
          </bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script>
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import { propOr } from 'ramda'
import IconWarningCircle from "../../icons/IconWarningCircle.vue"


export default {
  name: 'MontageErrorDialog',

  components: {
    IconWarningCircle,
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  mixins: [],

  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    viewerErrors: {
      type: Object,
      default: () => {}
    },
  },

  computed: {
    /**
     * Returns array of missing channel names expected to apply a montage
     * @returns {Array}
     */
    channelNames: function() {
      const channels = propOr([], 'channelNames', this.viewerErrors)
      return channels.length ? channels.join(', ') : ''
    },
  },

  methods: {
    onClose: function() {
      this.$emit('close')
    },
  }
}
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';
@use '../../../styles/element/dialog';

.montage-error-dialog {
  svg {
    color: theme.$red_1;
    display: block;
    margin: 0 auto 8px;
  }
}

.dialog-simple-buttons {
  button {
    cursor: pointer;
  }
}
</style>