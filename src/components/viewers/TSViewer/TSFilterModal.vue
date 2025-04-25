<template>
  <el-dialog class="timeseries-filter-modal" ref="filter-modal" title="Set Filter" :modelValue="visible"
    @update:modelValue="visible = $event" @close='close'>

    <template #default>
      <div slot="body">
        <div class="select-wrapper">
          <el-select v-model="selectedFilter" placeholder="Select">
            <el-option v-for="item in filterOptions" :key="item.value" :label="item.label" :value="item.value">
            </el-option>
          </el-select>

          <div v-if="computeVisible0" class="filter-input-wrapper">
            {{computePlaceholder1}}
            <el-input-number class="filterInput" v-model="input0" controls-position="right" :precision="2"
              @change="handleChange"></el-input-number>
          </div>

          <div v-if="computeVisible1" class="filter-input-wrapper">
            {{computePlaceholder2}}
            <el-input-number class="filterInput" v-model="input1" controls-position="right" :precision="2"
              @change="handleChange"></el-input-number>
          </div>

          <el-select v-model="selectedNotch" v-if="computeVisible2" placeholder="Select" class="filter-input-wrapper">
            <el-option v-for="item in notchOptions" :key="item.value" :label="item.label" :value="item.value">
            </el-option>
          </el-select>

        </div>
      </div>

    </template>

    <template #footer>
      <div slot="footer">
        <div class="button-wrapper">
          <div class="channels-selected">
            <IconSelection
            :height="24"
            :width="24"
            />
            <div v-if="onSingleChannel">
              Adding to single channel
            </div>
            <div v-else>
              Adding to {{selectedChannels}} Selected Channels
            </div>

          </div>
          <div class="buttons">
            <bf-button @click="submitForm">Set Filter
            </bf-button>
          </div>
        </div>

      </div>
    </template>


  </el-dialog>

</template>

<script>
import {
  mapState
} from 'vuex'

import EventBus from '../../../utils/event-bus'
import IconSelection from "../../icons/IconSelection.vue"

export default {
  name: 'TimeseriesFilterModal',

  components: {
    'bf-button': () => import('@/components/shared/bf-button/BfButton.vue'),
    IconSelection
  },

  mixins: [
  ],
  watch: {

  },
  computed: {
    ...mapState([
      'config'
    ]),
    ...mapState('viewerModule', [
      'activeViewer',
    ]),
    computeVisible0: function () {
      switch (this.selectedFilter) {
        case 'lowpass':
          return true
        case 'highpass':
          return true
        case 'bandpass':
          return true
        default:
          return false
      }
    },
    onSingleChannel: function () {
      return (this.onChannels.length == 1)
    },
    selectedChannels: function () {
      return this.onChannels.length
    },
    computeVisible1: function () {
      switch (this.selectedFilter) {
        case 'lowpass':
          return false
        case 'highpass':
          return false
        case 'bandpass':
          return true
        default:
          return false
      }
    },
    computeVisible2: function () {
      switch (this.selectedFilter) {
        case 'bandstop':
          return true
        default:
          return false
      }
    },
    computePlaceholder1: function (option) {
      switch (this.selectedFilter) {
        case 'lowpass':
          return 'Low Pass Cutoff Frequency (Hz)'
        case 'highpass':
          return 'High Pass Cutoff Frequency (Hz)'
        case 'bandpass':
          return 'Low Pass Cutoff Frequency (Hz)'
        default:
          return ''
      }
    },
    computePlaceholder2: function (option) {
      switch (this.selectedFilter) {
        case 'bandpass':
          return 'High Pass Cutoff Frequency (Hz)'
        default:
          return ''
      }
    },

  },
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data: function () {
    return {
      selectedFilter: null,
      filterOptions: [
        {
          label: 'No Filter',
          value: 'clear'
        },
        {
          label: 'Low Pass',
          value: 'lowpass'
        },
        {
          label: 'High Pass',
          value: 'highpass'
        },
        {
          label: 'Band Pass',
          value: 'bandpass'
        },
        {
          label: 'Notch',
          value: 'bandstop'
        }
      ],
      selectedNotch: null,
      notchOptions: [
        {
          label: '50Hz',
          value: 50
        },
        {
          label: '60Hz',
          value: 60
        }
      ],
      input0: null,
      input1: null,
      onChannels: []

    }

  },

  methods: {
    close: function () {
      this.$emit('closeWindow')
    },
    handleChange: function () {
    },
    onButtonClick: function () {
    },
    submitForm: function (e) {
      EventBus.$emit('active-viewer-action', {
        method: 'setTimeseriesFilters',
        payload: {
          selChannels: this.onChannels,
          filterType: this.selectedFilter,
          input0: this.input0,
          input1: this.input1,
          notch: this.selectedNotch
        }
      })
      this.$emit('closeWindow')
    },
  }
    }

</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.timeseries-filter-modal {
  display: block;
  box-sizing: border-box;
}

.filterInput {
  width: 100%
}

.select-wrapper {
  display: flex;
  flex-direction: column;
  border-left: 5px solid var(--dopamine)
}

#layerSelect {
  margin: 0 0 10px;
  width: auto;
}

.channels-icon {
  border: 1px solid var(--light-gray);
  border-radius: 2px;
  color: var(--light-gray);
  margin-right: 5px;
}

.button-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.channels-selected {
  display: flex;
  flex-direction: row;
  margin-right: 20px;
  line-height: 24px;

  svg {
    margin-right: 8px;
  }
}

h2 {
  margin: 20px 30px 30px 30px;
}

.filter-input-wrapper {
  margin-top: 24px;
}
</style>

<style lang="scss">
.timeseries-filter-modal span {
  font-size: 24px;
}
</style>