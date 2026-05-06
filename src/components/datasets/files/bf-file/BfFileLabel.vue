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

    <!--
      Placeholder rows (optimistic upload rows) and replace-conflict
      overlays (existing server rows that are being replaced) both
      render an Apple-style ring: determinate fill during upload
      (clockwise from 12 o'clock), indeterminate spin during the
      importing window. Failed falls through to the regular file icon.
      Real server rows in processing/uploading states keep the legacy
      pulsing bf-waiting-icon so nothing else in the app changes.
    -->
    <div
      v-if="showUploadRing"
      class="upload-ring-wrap mr-16"
      :class="{ 'upload-ring-wrap--spin': ringStatus === 'importing' }"
      :aria-label="ringStatus === 'importing' ? 'Importing' : 'Uploading'"
    >
      <svg class="upload-ring" viewBox="0 0 20 20" width="18" height="18">
        <circle class="ring-track" cx="10" cy="10" r="8" />
        <circle
          class="ring-fill"
          cx="10"
          cy="10"
          r="8"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringDashOffset"
        />
      </svg>
    </div>

    <div
      v-else-if="!isPlaceholder && !isUploadOverlay && (fileState === 'processing' || fileState === 'uploading')"
      class="icon-waiting mr-16"
    >
      <bf-waiting-icon />
    </div>

    <img
      v-else
      class="svg-icon icon-item mr-16"
      :class="{ 'icon-item--pin-top': isPlaceholder || isUploadOverlay }"
      :src="fileIcon(icon, file.content.packageType)"
      alt="package icon"
    >

    <div class="name-column">
      <template v-if="isRenaming">
        <input
          ref="renameInput"
          class="rename-input"
          :value="displayName"
          @keyup.enter="onRenameSubmit"
          @keyup.escape="onRenameCancel"
          @blur="onRenameSubmit"
          @click.stop
        />
      </template>
      <template v-else>
        <!--
          Overlay rows (existing server rows being replaced) render the
          name + status on a single line. el-table caches row heights
          for rows whose id already existed, so pushing the status to a
          second line gets clipped. Placeholder rows (new ids) keep the
          two-line layout where it's cleaner.
        -->
        <div
          v-if="isUploadOverlay"
          class="name-row-inline"
        >
          <button
            v-if="isNameLink"
            class="name"
            :disabled="disabled"
            @click.stop="onClick('click-name', $event)"
          >
            {{ displayName }}
          </button>
          <span v-else class="no-link-name">{{ displayName }}</span>
          <span
            v-if="ringStatus === 'uploading'"
            class="inline-status"
          >Replacing {{ progressPct }}%</span>
          <span
            v-else-if="ringStatus === 'importing'"
            class="inline-status importing"
          >Replacing&hellip;</span>
          <span
            v-else-if="ringStatus === 'failed'"
            class="inline-status failed"
          >Replace failed</span>
        </div>

        <button
          v-else-if="isNameLink && !isPlaceholder"
          class="name"
          data-cy="moveDialogFileName"
          :disabled="disabled"
          @click.stop="onClick('click-name', $event)"
        >
          {{ displayName }}
        </button>
        <div v-else-if="!isUploadOverlay" class="no-link-name placeholder-name">
          {{ displayName }}
          <span
            v-if="isPlaceholder && placeholderFileCount > 0"
            class="placeholder-file-count"
          >({{ placeholderFileCount }} files)</span>
        </div>
      </template>

      <!-- Placeholder meta (new-upload rows only). Overlay rows put
           their status inline above; they skip this block. -->
      <div
        v-if="isPlaceholder"
        class="placeholder-meta"
      >
        <span
          v-if="placeholderStatus === 'uploading'"
          class="status-label"
        >Uploading {{ progressPct }}%</span>
        <span
          v-else-if="placeholderStatus === 'importing'"
          class="status-label importing"
        >Importing&hellip;</span>
        <span
          v-else-if="placeholderStatus === 'failed'"
          class="status-label failed"
        >Upload failed</span>
      </div>
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
    },
    isRenaming: {
      type: Boolean,
      default: false
    }
  },

  watch: {
    isRenaming(val) {
      if (val) {
        this.$nextTick(() => {
          const input = this.$refs.renameInput;
          if (input) {
            input.focus();
            // Select the name without the extension
            const name = input.value;
            const lastDot = name.lastIndexOf('.');
            if (lastDot > 0) {
              input.setSelectionRange(0, lastDot);
            } else {
              input.select();
            }
          }
        });
      }
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

    // Client-side placeholder flags (see uploadModule
    // getPlaceholdersForFolder). Real server rows lack the _placeholder
    // marker, so every computed below collapses to a no-op for them.
    isPlaceholder: function() {
      return this.file && this.file._placeholder === true
    },
    // Set on server rows that are being replaced by a new upload
    // (see BfDatasetFiles.displayFiles / getReplaceOverlaysForFolder).
    // We render the same progress ring + status label as a placeholder,
    // but the row's server-side identity is preserved (clicking opens
    // the existing file, which is fine — the replacement lands later).
    isUploadOverlay: function() {
      return this.file && this.file._uploading === true
    },
    placeholderStatus: function() {
      return (this.file && this.file._placeholderStatus) || ''
    },
    placeholderFileCount: function() {
      return (this.file && this.file._placeholderFileCount) || 0
    },
    // Unified status driver: placeholder rows read _placeholderStatus,
    // overlay rows read _uploadStatus. Both resolve to one of
    // 'uploading' | 'importing' | 'failed' (or '' when not applicable).
    ringStatus: function() {
      if (this.isUploadOverlay) return (this.file && this.file._uploadStatus) || ''
      if (this.isPlaceholder) return this.placeholderStatus
      return ''
    },
    // Ring should show whenever we're in an uploading/importing state;
    // failures fall through to the regular icon so the error treatment
    // on the meta label is clear.
    showUploadRing: function() {
      const s = this.ringStatus
      return (this.isPlaceholder || this.isUploadOverlay) && (s === 'uploading' || s === 'importing')
    },
    progressPct: function() {
      const progress = this.isUploadOverlay
        ? (this.file && this.file._uploadProgress)
        : (this.file && this.file._progress)
      if (!progress || !progress.total) return 0
      const pct = Math.floor((progress.loaded / progress.total) * 100)
      return Math.max(0, Math.min(100, pct))
    },

    // Ring geometry. Circle r=8 in a 20x20 viewBox; C = 2πr ≈ 50.27. For
    // the importing (indeterminate) phase we draw a fixed ~25% arc and
    // let CSS rotate the element, so dashoffset is constant there.
    ringCircumference: function() {
      return 50.27
    },
    ringDashOffset: function() {
      if (this.ringStatus === 'importing') {
        // Visible arc length ≈ 25% of circumference.
        return this.ringCircumference * 0.75
      }
      const filled = this.progressPct / 100
      return this.ringCircumference * (1 - filled)
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

    onRenameSubmit: function () {
      const input = this.$refs.renameInput;
      if (input) {
        const newName = input.value.trim();
        this.$emit('rename-submit', newName);
      }
    },

    onRenameCancel: function () {
      this.$emit('rename-cancel');
    },

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
        'READY': 'processed',
        // Client-side placeholder states (see uploadModule
        // getPlaceholdersForFolder).
        'UPLOADING': 'uploading',
        'IMPORTING': 'importing',
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
        'READY': 'processed',
        'UPLOADING': 'uploading',
        'IMPORTING': 'importing',
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
          'subtype',
          'Viewer'
        ).toLowerCase()
        
        const isTimeseriesCollection = collectionSubtype.toLowerCase() === 'pennsieve_timeseries';
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

.rename-input {
  flex: 1;
  font-size: 13px;
  font-family: inherit;
  padding: 2px 8px;
  border: 1px solid theme.$purple_3;
  border-radius: 3px;
  outline: none;
  background: white;
  color: theme.$gray_6;
  min-width: 0;
  height: 24px;
  box-sizing: border-box;

  &:focus {
    box-shadow: 0 0 0 2px rgba(theme.$purple_3, 0.2);
  }
}

.btn-open-file {
  display: none;
}

.hover-row,
.el-table__row:hover {
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

.icon-waiting--pin-top,
.icon-item--pin-top {
  align-self: flex-start;
}

.upload-ring-wrap {
  align-items: center;
  align-self: flex-start;
  display: flex;
  flex-shrink: 0;
  height: 24px;
  justify-content: center;
  width: 24px;
}

.upload-ring {
  display: block;
  // Start the fill at 12 o'clock; SVG default is 3 o'clock.
  transform: rotate(-90deg);
  transform-origin: center;
}

// Importing phase: slow rotation + subtle opacity pulse, muted color.
// Reads as "background activity" vs. the active primary-color fill of
// the uploading phase.
.upload-ring-wrap--spin .upload-ring {
  animation: upload-ring-spin 2.4s linear infinite;
}
.upload-ring-wrap--spin .ring-fill {
  animation: upload-ring-pulse 1.8s ease-in-out infinite;
  stroke: theme.$purple_1;
}

@keyframes upload-ring-spin {
  from { transform: rotate(-90deg); }
  to { transform: rotate(270deg); }
}
@keyframes upload-ring-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}

.ring-track {
  fill: none;
  stroke: theme.$gray_2;
  stroke-width: 2;
}

.ring-fill {
  fill: none;
  stroke: theme.$app-primary-color;
  stroke-linecap: round;
  stroke-width: 2;
  transition: stroke-dashoffset 180ms linear;
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

.name-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.placeholder-name {
  color: theme.$gray_5;
}

.placeholder-file-count {
  color: theme.$gray_4;
  font-size: 12px;
  margin-left: 8px;
}

.placeholder-meta {
  display: flex;
  font-size: 11px;
  line-height: 1;
  margin-top: 2px;
}

.name-row-inline {
  align-items: baseline;
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.inline-status {
  color: theme.$gray_5;
  flex-shrink: 0;
  font-size: 12px;
  font-style: italic;

  &.importing {
    color: theme.$gray_5;
  }
  &.failed {
    color: theme.$red_1;
    font-style: normal;
    font-weight: 500;
  }
}

.status-label {
  color: theme.$gray_5;

  &.importing {
    font-style: italic;
  }
  &.failed {
    color: theme.$red_1;
  }
}
</style>

