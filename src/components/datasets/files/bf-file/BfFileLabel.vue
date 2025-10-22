<template>
  <div
    class="bf-file-label"
    :class="[
      interactive ? 'interactive' : 'non-interactive',
      shouldShowBtnOpen ? 'show-btn-open-file' : ''
    ]"
    @click="onClick('click', $event)"
  >
    <div
      v-if="shouldShowBtnOpen"
      class="btn-open-file mr-16"
    >
      <button
        class="button-icon btn-icon-viewer"
        @click="openViewerOptions"
      >
        <IconEyeball
          :height="16"
          :width="16"
        />
      </button>
    </div>

    <div
      v-if="fileState === 'processing' || fileState === 'uploading'"
      class="icon-waiting mr-16"
    >
      <bf-waiting-icon />
    </div>

    <img
      v-if="fileState !== 'processing' && fileState !== 'uploading'"
      class="svg-icon icon-item mr-16"
      :src="fileIcon(icon, file.content.packageType)"
      alt="package icon"
    >

    <button
      v-if="isNameLink"
      class="name"
      data-cy="moveDialogFileName"
      :disabled="disabled"
      @click.stop="onClick('click-name', $event)"
    >
      {{ displayName }}
    </button>
    <div v-else class="no-link-name">
      {{ displayName }}
    </div>
  </div>
</template>

<script>
import {
  isNil,
  path,
  pathOr,
  propOr
} from 'ramda'
import { mapActions } from 'vuex'
import BfWaitingIcon from '../../../shared/bf-waiting-icon/bf-waiting-icon.vue'


import FileIcon from '../../../../mixins/file-icon/index'
import GetFileProperty from '../../../../mixins/get-file-property'
import FileTypeMapper from '../../../../mixins/FileTypeMapper'
import { packageDisplayName } from '../../../../utils/packages'

import validUrl from 'valid-url'
import IconEyeball from "../../../icons/IconEyeball.vue";
import IconLink from "../../../icons/IconLink.vue";

export default {
  name: 'BfFileLabel',

  components: {
    IconEyeball,
    BfWaitingIcon,
    IconLink
  },

  mixins: [
    FileIcon,
    GetFileProperty,
    FileTypeMapper
  ],

  props: {
    isNameLink: {
      type: Boolean,
      default: true
    },
    file: {
      type: Object,
      default: () => {}
    },
    interactive: {
      type: Boolean,
      default: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    openFileButton: {
      type: Boolean,
      default: false
    },
    searchAllDataMenu: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    /**
     * Compute the display name which will decode
     * the response from the API
     * @returns {String}
     */
    displayName: function() {
      return packageDisplayName(this.file.content.name, this.file.extension, this.file.children)
    },

    /**
     * Compute if the file type has a viewer associate with it
     * @returns {Boolean}
     */
    packageHasViewer: function() {
      const packageType = pathOr('', ['content', 'packageType'], this.file)

      let hasViewer = isNil(this.typeMapper[packageType]) === false

      const packageProperties = propOr([], 'properties', this.file)
      const subtype = this.getFilePropertyVal(
        packageProperties,
        'subtype'
      ).toLowerCase()

      if (this.whitelist.indexOf(subtype) >= 0) {
        hasViewer = true
      }
      
      const isTimeseriesFile = packageType.toLowerCase() === 'timeseries';
      let isFileUnprocessed = false;
      if (isTimeseriesFile) {
        isFileUnprocessed = this.isFileUnprocessed(this.file);
      }

      if (isFileUnprocessed) {
        hasViewer = false
      }

      return hasViewer
    },

    fileState: function() {
      return this.getFileState(this.file)
    },
    /**
     * Compute package type
     * @returns {String}
     */
    packageType: function() {
      return pathOr('', ['content', 'packageType'], this.file)
    },

    /**
     * Computes icon
     * @returns {String}
     */
    icon: function() {
      return (
        this.file.icon || this.getFilePropertyVal(this.file.properties, 'icon')
      )
    },

    /**
     * Compute if the open file button should
     * be visible for a package
     * @returns {Boolean}
     */
    shouldShowBtnOpen: function() {
      return this.collectionHasViewer || this.packageHasViewer
    },

    collectionHasViewer: function() {
      const isTimeseriesCollectionProcessed = this.isTimeseriesCollectionProcessed(this.file)
      return isTimeseriesCollectionProcessed
    },

    /**
     * Checks if file type is an MS Office File
     * @returns {String}
     */
    isMSOfficeFile: function() {
      return this.file.subtype === 'MS Word' || this.file.subtype === 'MS Powerpoint' || this.file.subtype === "MS Excel"
    }
  },


  methods: {
    ...mapActions([
       'updateSearchModalVisible'
    ]),
    ...mapActions('filesModule', [
       'openOffice365File'
    ]),

    isFileUnprocessed: function (file) {
      const fileState = this.getFileState(file)
      if (fileState !== 'processed') {
        return true;
      } else {
        return false;
      }
    },

    isCollectionProcessed: function (collection) {
      const collectionState = this.getCollectionState(collection)
      if (collectionState === 'processed') {
        return true;
      } else {
        return false;
      }
    },

    getFileState: function(file) {
      const states = {
        'UPLOADED': 'unprocessed',
        'PROCESSING': 'processing',
        'RUNNING': 'processing',
        'UNAVAILABLE': 'uploading',
        'PENDING': 'processing',
        'ERROR': 'failed',
        'READY': 'processed'
      }
      const fileState = path(['content', 'state'], file)
      return states[fileState] ? states[fileState] : ''
    },

    getCollectionState: function(collection) {
      const states = {
        'UPLOADED': 'unprocessed',
        'PROCESSING': 'processing',
        'RUNNING': 'processing',
        'UNAVAILABLE': 'uploading',
        'PENDING': 'processing',
        'ERROR': 'failed',
        'READY': 'processed'
      }
      const collectionState = path(['content', 'state'], collection)
      return states[collectionState] ? states[collectionState] : ''
    },

    isTimeseriesCollectionProcessed: function(datasetPackage) {
      let isCollectionProcessed = false;
      const packageType = pathOr('', ['content', 'packageType'], datasetPackage)
      const isCollectionPackageType = packageType === 'Collection'

      if(isCollectionPackageType) {
        const collectionProperties = propOr([], 'properties', this.file)
        const collectionSubtype = this.getFilePropertyVal(
          collectionProperties,
          'subtype'
        ).toLowerCase()

      const isTimeseriesCollection = collectionSubtype.toLowerCase() === 'mef timeseries';

      if (isTimeseriesCollection) {
        isCollectionProcessed = this.isCollectionProcessed(this.file);
      }

      return isCollectionProcessed;
      }
    },
    /**
     * Handles click event
     * @param {String} name
     * @param {Object} evt
     */
    onClick: function(name, evt) {
      this.$emit(name, evt)
    },

    /**
     * Opens different viewer depending on file type
     */
    openViewerOptions: function() {
      if (this.isMSOfficeFile) {
        return this.openOffice365File(this.file)
      } else {
        return this.openViewer()
      }
    },

    /**
     * Open viewer
     */
    openViewer: function() {
      if (this.searchAllDataMenu){
        this.updateSearchModalVisible(false)
      }
      const fileId = pathOr('', ['content', 'nodeId'], this.file)

      if (fileId) {
        this.$router.push({
          name: 'viewer',
          params: { fileId }
        })
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme';


.no-link-name {
  color: theme.$gray_6
}

.btn-open-file {
  display: none;
}

.hover-row {
  background: #f5f6f9;
  .show-btn-open-file {
    .btn-open-file {
      display: inline-block;
    }
    .icon-item {
      display: none;
    }
  }
}

.bf-file-label {
  align-items: center;
  display: flex;
  flex-direction: row;
}
.svg-icon {
  flex-shrink: 0;
  height: 24px;
  width: 24px;
}
.name {
  font-size: inherit;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;

  .interactive & {
    &:hover,
    &:focus {
      cursor: pointer;
      color: theme.$app-primary-color;
      text-decoration: underline;
    }
  }
}

.icon-waiting {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 24px;
  justify-content: center;
  width: 24px;
}

.btn-open-file {
  line-height: 1;
  .btn-icon-viewer {
    align-items: center;
    background: theme.$app-primary-color;
    color: #fff;
    height: 24px;
    justify-content: center;
    padding: 0;
    width: 24px;
    &:hover,
    &:focus {
      background: theme.$purple_3;
    }
    &:hover {
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
    }
  }
}
</style>

