<template>
  <div>
    <div class="bf-viewer">

      <bf-rafter class="viewer-rafter">
        <template #heading>
          <stage-actions class="stage-actions">
            <template #left>
              <div class="file-info">
                File: {{packageName}}
              </div>

            </template>
            <template #right>
              <router-link
                class="close-action"
                :to="{
                name: 'file-record',
                params: {

                }
              }"
              >
                <div  @click="">
                  Close
                </div>
              </router-link>

            </template>
          </stage-actions>
        </template>
      </bf-rafter>

      <div id="viewer-wrap">
        <viewer-toolbar
          v-show="!hideToolbars"
          class="left"
        >
          <el-tooltip
            v-for="tool in availableTools"
            :key="tool.eventName"
            placement="right"
            :content="tool.tooltip"
          >
            <button
              class="btn-icon"
              :class="[
                tool.eventName === viewerActiveTool ? `selected ${tool.icon}` : `${tool.icon}`
              ]"
              @click="setActiveTool(tool.eventName)"
            >
              <component :is="tool.icon"
                :height="20"
                :width="20"
              />
            </button>
          </el-tooltip>
        </viewer-toolbar>

        <div
          v-if="!hasItems"
          id="empty"
        >
          <IconNeural
            class="neural-icon"
            :height="50"
            :width="50"
            :original="true"
          />
          <h2 class="sharp-sans">
            No package selected
          </h2>
          <p>
            Select a package that you want to view from your <router-link :to="{name: 'datasets-list'}">
            Datasets
          </router-link>.
          </p>
        </div>

        <viewer-pane v-else
                     ref="viewerPane"
                     :pkg="activeViewer"
        />

        <viewer-toolbar
          v-show="!hideToolbars"
          class="right"
        >
          <el-tooltip
            v-for="palette in availablePalettes"
            :key="palette.eventName"
            placement="left"
            :content="palette.tooltip"
          >
            <button
              class="btn-icon"
              :class="computePaletteClass(palette.eventName)"
              @click="togglePanel(palette)"
            >

              <component :is="palette.icon"
                         :height="20"
                         :width="20"
              />

            </button>
          </el-tooltip>
        </viewer-toolbar>

        <bf-viewer-side-panel
          :side-panel-open="viewerSidePanelOpen"
          :side-panel-view="viewerSidePanelView"
        />
      </div>

      <!--    <montage-error-dialog-->
      <!--      :is-open="isMontageDialogOpen"-->
      <!--      :viewer-errors="viewerErrors"-->
      <!--      @close="onMontageDialogClose"-->
      <!--    />-->
    </div>
  </div>


</template>

<script>
import { mapState, mapActions } from 'vuex'
import { propOr, pathOr, path, defaultTo, prop, find, propEq } from 'ramda'

import ViewerToolsPalettes from '../ViewerToolsPalettes'
import ViewerPane from '../ViewerPane/ViewerPane.vue'
// import BfHeader from '../../bf-header/BfHeader.vue'
import BfViewerSidePanel from '../BfViewerSidePanel/BfViewerSidePanel.vue'
import ViewerToolbar from '../ViewerToolbar/ViewerToolbar.vue'
// import MontageErrorDialog from '../MontageErrorDialog/MontageErrorDialog.vue'

import Request from '../../../mixins/request'
import ConfirmChanges from '../../../mixins/confirm-changes'
import EventBus from '../../../utils/event-bus'
import { viewerSidePanelTypes, viewerToolTypes } from '@/utils/constants'
import IconNeural from "../../icons/IconNeural.vue";
import StageActions from "../../shared/StageActions/StageActions.vue";
import BfStage from "../../layout/BfStage/BfStage.vue";
import IconHand from "../../icons/IconHand.vue";
import IconDashedAnnotation from "../../icons/IconDashedAnnotation.vue";
import IconPencil from "../../icons/IconPencil.vue";
import IconRuler from "../../icons/IconRuler.vue";
import IconAnnotation from "../../icons/IconAnnotation.vue";
import IconCompass from "../../icons/IconCompass.vue";
import IconChannel from "../../icons/IconChannel.vue";
import IconInfo from "../../icons/IconInfo.vue";
import IconDiscussion from "../../icons/IconDiscussion.vue";
import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import CircleIcon from "../../shared/CircleIcon/CircleIcon.vue";
import IconMouseCursor from "../../icons/IconMouseCursor.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";


export default {
  name: 'PsViewer',
  components: {
    CircleIcon,
    BfRafter,
    StageActions,
    IconNeural,
    ViewerPane,
    BfStage,
    BfViewerSidePanel,
    // BfHeader,
    ViewerToolbar,
    // MontageErrorDialog
    IconHand,
    IconDashedAnnotation,
    IconPencil,
    IconRuler,
    IconAnnotation,
    IconCompass,
    IconChannel,
    IconInfo,
    IconDiscussion,
    IconMouseCursor
  },
  mixins: [
    Request,
    ViewerToolsPalettes,
    ConfirmChanges
  ],
  data: function() {
    return {
      isPackageLoading: false,
      isMontageDialogOpen: false
    }
  },
  computed: {
    ...mapState([
      'config',
      'dataset',
      'profile',
      'activeOrganization',
      'bulkEditingChannels'
    ]),
    ...mapState('viewerModule', [
      'activeViewer',
      'viewerSidePanelOpen',
      'viewerSidePanelView',
      'viewerActiveTool',
      'viewerErrors',
      'viewerMontageScheme'
    ]),

    packageName: function() {
      return pathOr('file', ['content','name'], this.activeViewer)
    },


    /**
     * Compute if left and right toolbars should be visible
     * @returns {Boolean}
     */
    hideToolbars: function() {
      const viewer = defaultTo({}, this.activeViewer)
      return Object.keys(viewer).length <= 0
    },
    /**
     * Compute if there are any items open
     * @returns {Boolean]}
     */
    hasItems: function() {
      const queryParams = propOr({}, 'query', this.$route)
      const viewer = defaultTo({}, this.activeViewer)
      return Object.keys(viewer).length > 0 || this.isPackageLoading || (Object.keys(queryParams).length && queryParams.p)
    },

    /**
     * Compute viewer error type
     * @returns {String}
     */
    viewerErrorType: function() {
      return propOr('', 'error', this.viewerErrors)
    }
  },
  watch: {

    /**
     * Trigger montage error dialog to open for PackageCannotBeMontaged error type
     */
    viewerErrorType: {
      handler: function(error) {
        if (error === 'PackageCannotBeMontaged') {
          this.isMontageDialogOpen = true
        }
      }
    }
  },
  /**
   * Vue lifecycle method
   */
  mounted: function() {
    EventBus.$on('active-viewer-action', this.onActiveViewerAction.bind(this))
    EventBus.$on('data-changed', this.onDataChanged.bind(this))
    this.getFile()
  },
  beforeDestroy() {
    EventBus.$off('active-viewer-action', this.onActiveViewerAction.bind(this))
    EventBus.$off('data-changed', this.onDataChanged.bind(this))
  },
  methods: {
    ...mapActions('viewerModule', ['openViewer', 'setSidePanel', 'closeViewer', 'setActiveTool', 'setViewerErrors', 'setViewerMontageScheme']),
    ...mapActions(['setDatasetRole']),

    /**
     * Watch active viewer change
     */
    watchActiveViewer: function() {
      // Reset palette if new viewer doesn't have that palette
      if (this.availablePalettes) {
        const paletteExists = find(propEq('eventName', this.viewerSidePanelView), this.availablePalettes)
        if (!paletteExists) {
          this.setSidePanel({
            open: this.viewerSidePanelOpen,
            view: viewerSidePanelTypes.INFO_PANEL
          })
        }
      }
      // Reset tool if new viewer doesn't have that palette
      if (this.availableTools) {
        const toolExists = find(propEq('eventName', this.viewerActiveTool), this.availableTools)
        if (!toolExists) {
          this.setActiveTool(viewerSidePanelTypes.POINTER)
        }
      }
    },
    /**
     * Invoke method on viewer
     * Event emitted from palettes
     * @param {Object} evt
     */
    onActiveViewerAction: function(evt) {
      if (this.$refs.viewerPane) {
        this.$refs.viewerPane.activeViewerAction(evt)
      }
    },
    /**
    * Get file data to send to bf-viewer
    */
    getFile: function() {

      useGetToken()
        .then(token => {
          this.isPackageLoading = true
          const id = pathOr('', ['params', 'fileId'], this.$route)
          const url = `${this.config.apiUrl}/packages/${id}?api_key=${token}`

          return useSendXhr(url)
            .then(response => {
              this.openViewer(response)
              this.isPackageLoading = false
              // Get the dataset info if not already available
              const datasetId = path(['content', 'datasetId'], response)
              const existingDatasetId = pathOr('', ['content', 'id'], this.dataset)
              if (datasetId && datasetId !== existingDatasetId) {
                this.fetchDataset(datasetId)
              }
            })
        })
        .catch(useHandleXhrError)
    },
    fetchDataset: function(id) {
      useGetToken()
        .then(async token => {
          const url = `${this.config.apiUrl}/datasets/${id}?api_key=${token}`
          return this.sendXhr(url)
            .then(async response => {
              this.$store.dispatch('updateDataset', response)
              EventBus.$emit('get-file-proxy-id')

              const datasetId = pathOr(0, ['content', 'id'], this.dataset)
              const url = `${this.config.apiUrl}/datasets/${datasetId}/role?api_key=${token}`
              return this.sendXhr(url)
                .then(response => {
                  this.setDatasetRole(response)
                })
            })
        })
        .catch(response => {
          this.handleXhrError(response)
        })
    },

    /**
     * Compute palette class
     * @param {String} eventName
     * @returns {String}
     */
    computePaletteClass: function(eventName) {
      return (eventName === this.viewerSidePanelView && this.viewerSidePanelOpen) ? 'selected' : ''
    },
    /**
     * Toggle the palatte panel open/close and change palette
     * @param {String} palette
     */
    togglePanel: function(palette) {
      // don't open palette if user is bulk editing channels
      if (this.bulkEditingChannels) {
        return
      }

      let isOpen = true
      // If the side panel view is already set to the new view
      if(this.viewerSidePanelOpen && this.viewerSidePanelView === palette.eventName) {
        isOpen = false
      }
      this.setSidePanel({
        view: palette.eventName,
        open: isOpen
      })
    },

    /**
     * Handle montage error dialog close event
     */
    onMontageDialogClose: function() {
      this.isMontageDialogOpen = false
      this.setViewerMontageScheme('NOT_MONTAGED')
      this.setViewerErrors({})
    },

    /**
     * Handle fetch montage scheme event
     */
    onFetchMontageScheme: function() {
      this.isMontageDialogOpen = false
      this.onActiveViewerAction({
        method: 'fetchMontageScheme',
        payload: {
          detail: {
            montage: this.viewerMontageScheme
          }
        }
      })
    },

    /**
     * Listen for data changes and modify the list that keeps track of changes
     * changedProperties Array is defined in ConfirmChanges mixin
     * @param {Object} prop
     */
    onDataChanged: function(prop) {
      const index = this.changedProperties.indexOf(prop.id)
      if (index >= 0) {
        this.changedProperties.splice(index, 1)
      } else {
        this.changedProperties.push(prop.id)
      }
    },

    /**
     * Handle loss changes confirmation
     */
    onConfirmLossOfChanges: function() {
      this.closeViewer()
    }
  },
}
</script>

<style lang="scss" scoped>
  @import '../../../assets/_variables.scss';

  .close-action {
    align-self: center;
    cursor: pointer;
    color: $white;
  }

  .file-info {
    align-self: center;
    color: $white;
  }


  .stage-actions {

    height: 32px;
    align-items: center;
  }
  .bf-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  #viewer-wrap {
    flex: 1;
    display: flex;
  }
  #empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    text-align: center;
    .svg-icon {
      margin: 78px auto 20px auto;
      width: 100px;
    }
  }
  .btn-icon {
    color: $gray_4;
    margin-top: 20px;
    &:first-child {
      margin: 0;
    }
    &.selected, &:hover, &[focused] {
      color: $app-primary-color;
    }
    &[disabled] {
      color: $gray_2;
    }
  }
</style>
<style lang="scss">

  #empty {
    align-self: center;
    margin-top: 48px;

    .neural-icon {
      align-self: center;
    }
  }
  .bf-viewer {
    paper-ripple {
      display: none;
    }
  }
</style>
