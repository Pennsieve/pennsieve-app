<template>
  <el-dialog
    class="ts-custom-montage-dialog"
    ref="custom-montage-modal"
    :title="dialogTitle"
    :modelValue="visible"
    @update:modelValue="visible = $event"
    @close="close"
    @closed="onClosed">

    <div slot="body">

      <div class="description-wrapper">
        <div class="select-label">
          Description
        </div>
        <p> Provide the montage as a string. This is a temporary solution until we have full support for storing custom montages.</p>
        <el-input
          ref="input"
          v-model="montageString"
          placeholder='Example: [["C3","C4"],["C4","C3"]]'
        />

      </div>
    </div>

    <div slot="footer">
      <div class="button-wrapper">
        <div class="buttons">
          <bf-button
            @click="submitForm"
          > {{ actionButtonText }}
          </bf-button>
        </div>
      </div>

    </div>
  </el-dialog>
</template>

<script>
import {
  propOr
} from 'ramda'

import {mapState, mapActions} from "vuex";
import IconSelection from "../../icons/IconSelection.vue";
import { defineAsyncComponent } from 'vue'

export default {
  name: 'TsAnnotationModal',

  components: {
    IconSelection,
    'bf-button': defineAsyncComponent(() => import('@/components/shared/bf-button/BfButton.vue'))
  },

  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },

  data: function () {
    return {
      montageString: '',
    }
  },
  mounted() {
  },
  computed: {
    ...mapState('viewerModule', [
      'activeAnnotation',
      'activeViewer',
      'viewerChannels',
      'viewerActiveTool',
      'viewerAnnotations'
    ]),
    dialogTitle: function() {
      return "Provide Montage"

    },
    actionButtonText: function() {
      return "Set"
    },
  },

  methods: {
    ...mapActions('viewerModule', [
      'setCustomMontageMap',
    ]),
    submitForm: function() {
      console.log('asdsad')
      this.$store.dispatch('viewerModule/setCustomMontageMap', {montageScheme:'CUSTOM_MONTAGE', customMontageMap: this.montageString})
      this.$emit('close')
    },
    /**
     * Emit event to update the synced property
     */
    close: function() {
      this.$emit('closeWindow')
    },

  }
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.ts-custom-montage-dialog {
  color: white;
  display: block;
  box-sizing: border-box;
}

.select-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 16px;
  align-items: center;

}

.description-wrapper {
  margin: 16px 0;
}

.button-wrapper {
  min-width: 500px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.channels-selected {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.date-time-picker {
  width:100%
}

.select-label {
  font-weight: 500;
  margin-bottom: 5px;
}

.inline-icon {
  margin-right: 8px;
}

.range-type-selector {
  margin-right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;

}

.mb-16 {
  color: $red_1
}

h2 {
  color: #000;
  font-size: 14px;
  list-style: 16px;
  margin: 0 0 8px;
}

.layerSelect {

}
</style>
