<!--
User drops files on dropzone ->
File-manifest is created locally in mem.

User click upload ->
Manifest is created ->
(optional) User verifies manifest is okay ->
Files are uploaded

User drops folder on dropzone ->
Message currently not supported.

User started upload and re-opens window ->
User cannot add files, but can track progress

Upload completed ->
User notified -> User can initiate new upload
with same manifest. Manifest is used for entire session.

User archives manifest -> remove activeManifest from memory

-->


<template>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="true"
      @close="onClose"
    >
      <template #header>
        <bf-dialog-header
          :title="dialogTitle"
        />

      </template>



      <div
        v-if="isUploading || uploadComplete"
        v-for="[key, value] in uploadMap" :key="key">

        <PsUploadFile :upload-object="value"/>

      </div>
      <div
        v-else
        v-for="item in uploadFiles">


        <PsManifestFile :file="item"/>

      </div>

      <template #footer>
        <bf-button
          class="secondary"
          @click="cancelQueue"
        >
          Cancel
        </bf-button>
        <bf-button
          @click="startUpload"
        >
          Start Upload
        </bf-button>

      </template>


    </el-dialog>
</template>

<script lang=ts setup>

import { reactive, computed } from 'vue'
import { useStore } from 'vuex'
import BfButton from '../shared/bf-button/BfButton.vue';
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import {FileRejectReason} from "vue3-dropzone";
import {pathOr} from "ramda";
import PsUploadFile from './PsUploadFile.vue'
import PsManifestFile from "./PsManifestFile.vue";

const store = useStore()

defineExpose({
  onDrop
})

const props = defineProps({
  file: Object,
  dialogVisible: Boolean
})

const uploadFiles = computed(() => store.getters['uploadModule/getManifestFiles']())
const uploadMap = computed( () => store.getters['uploadModule/getUploadMap']())
const isUploading = computed( () => store.getters['uploadModule/getIsUploading']())
const uploadComplete = computed( () => store.getters['uploadModule/getUploadComplete']())

const dialogTitle = computed( () => {
  return 'Add Files to Upload'
})

function onDrop(acceptedFiles: File[], rejectReasons: FileRejectReason[]) {
  console.log('on-drop in pennsieve-upload')
  store.dispatch('uploadModule/addManifestFiles', acceptedFiles)

}

function startUpload() {
  console.log('Starting Upload')

  store.dispatch('uploadModule/getManifestNodeId').then(
    () => store.dispatch('uploadModule/syncManifest')
  ).then(
    () => store.dispatch('uploadModule/UploadFiles')
  )

}

function onClose() {
  console.log('close')
}


</script>



<!--<script>-->
<!--import { mapActions, mapGetters, mapState } from 'vuex';-->
<!--import BfButton from '../shared/bf-button/BfButton.vue'-->
<!--import CheckOverflow from '../../mixins/check-overflow/index'-->
<!--import Sorter from '../../mixins/sorter'-->
<!--import Request from '../../mixins/request';-->
<!--import FileIcon from '../../mixins/file-icon'-->
<!--import debounce from 'lodash.debounce'-->
<!--import {v1 as uuidv1} from "uuid";-->
<!--import {-->
<!--  compose,-->
<!--  defaultTo,-->
<!--  equals,-->
<!--  filter,-->
<!--  find,-->
<!--  findIndex,-->
<!--  init,-->
<!--  pathOr,-->
<!--  pluck,-->
<!--  prop,-->
<!--  propEq,-->
<!--  propOr,-->
<!--  split,-->
<!--  sum-->
<!--} from 'ramda';-->
<!--import EventBus from '../../utils/event-bus';-->

<!--const transformPath = compose(-->
<!--  init,-->
<!--  filter(i => i),-->
<!--  split('/')-->
<!--)-->

<!--export default {-->
<!--  name: 'PennsieveUpload',-->

<!--  components: {-->
<!--    BfButton,-->
<!--  },-->

<!--  props: {-->
<!--      dialogVisible: {-->
<!--      type: Boolean,-->
<!--      default: false-->
<!--    }-->
<!--  },-->

<!--  mixins: [Sorter, CheckOverflow, Request, FileIcon],-->

<!--  data: function() {-->
<!--    return {-->
<!--      isDragging: false,-->
<!--      fileList: [],-->
<!--      packageList: [],-->
<!--      isAddingFiles: true,-->

<!--    }-->
<!--  },-->

<!--  computed: {-->
<!--    ...mapGetters(['config', 'userToken', 'uploadDestination']),-->
<!--    ...mapState(['onboardingEvents', 'activeOrganization', 'dataset']),-->

<!--    /**-->
<!--     * Compute dialog title based on isAddingFiles-->
<!--     * @returns {string}-->
<!--     */-->
<!--    dialogTitle: function() {-->
<!--      return this.isAddingFiles ? 'Add Files to Upload' : 'File Upload Status'-->
<!--    },-->

<!--    /**-->
<!--     * Compute files that are being processed-->
<!--     * @returns {Array}-->
<!--     */-->
<!--    filesProcessing: function() {-->
<!--      return filter(propEq('processing', true), this.fileList)-->
<!--    },-->

<!--    /**-->
<!--     * Compute if there are warning/error meessages to show-->
<!--     * @returns {Boolean}-->
<!--     */-->
<!--    showWarnings: function() {-->
<!--      return this.hasWarnings-->
<!--    },-->

<!--    /**-->
<!--     * Compute if any of the queued packages have warnings-->
<!--     * @returns {Boolean}-->
<!--     */-->
<!--    hasWarnings: function() {-->
<!--      return this.warningPackages.length > 0-->
<!--    },-->

<!--    /**-->
<!--     * Compute packages that have warnings-->
<!--     * @returns {Array}-->
<!--     */-->
<!--    warningPackages: function() {-->
<!--      return this.packageList.filter(item => {-->
<!--        return item.warnings.length-->
<!--      })-->
<!--    },-->

<!--    /**-->
<!--     * Compute packages that do not have warnings-->
<!--     * @returns {Array}-->
<!--     */-->
<!--    goodPackages: function() {-->
<!--      return this.packageList.filter(item => {-->
<!--        return item.warnings.length === 0-->
<!--      })-->
<!--    },-->

<!--    onboardingEventsUrl() {-->
<!--      const apiUrl = propOr('', 'apiUrl', this.config)-->
<!--      if (apiUrl && this.userToken) {-->
<!--        return `${apiUrl}/onboarding/events?api_key=${this.userToken}`-->
<!--      }-->
<!--    }-->
<!--  },-->

<!--  watch: {-->
<!--    fileList: function(newFileList, oldFileList) {-->
<!--      // Only get package preview if adding a file to the list-->
<!--      if (newFileList.length > oldFileList.length) {-->
<!--        // Show onboarding info if first time-->
<!--        const hasSeenInfo = localStorage.getItem('seen-upload-info')-->
<!--        if (!hasSeenInfo) {-->
<!--          this.showInfo = true-->
<!--        }-->

<!--        this.getPackages()-->
<!--      }-->

<!--      this.checkOverflow(this.$refs.packageWrap)-->
<!--    },-->

<!--    packageList: function() {-->
<!--      this.checkOverflow(this.$refs.packageWrap)-->
<!--    },-->

<!--    uploadList: function() {-->
<!--      this.checkOverflow(this.$refs.uploadWrap)-->
<!--    },-->

<!--    isOpen: function() {-->
<!--      // Look at the conceptId & instanceId query params and update locate state-->
<!--      const modelId = pathOr('', ['params', 'conceptId'])(this.$route)-->
<!--      const recordId = pathOr('', ['params', 'instanceId'])(this.$route)-->

<!--      if (modelId && recordId) {-->
<!--        this.modelId = modelId-->
<!--        this.recordId = recordId-->
<!--      }-->
<!--    }-->

<!--  },-->

<!--  methods: {-->
<!--    ...mapActions(['updateOnboardingEvents']),-->

<!--    /**-->
<!--     * Compute if array has items-->
<!--     */-->
<!--    hasItems: function(list) {-->
<!--      return list && list.length > 0 ? true : false-->
<!--    },-->

<!--    /**-->
<!--     * Set is dragging property if the user is adding files-->
<!--     * @param {Boolean} isDragging-->
<!--     */-->
<!--    setIsDragging: function(isDragging) {-->
<!--      if (this.isAddingFiles) {-->
<!--        this.isDragging = isDragging-->
<!--      }-->
<!--    },-->

<!--    /**-->
<!--     * Dismiss onboarding info-->
<!--     */-->
<!--    dismissInfo: function() {-->
<!--      this.showInfo = false-->
<!--      localStorage.setItem('seen-upload-info', true)-->
<!--    },-->

<!--    /**-->
<!--     * Cancel queueing files for upload-->
<!--     */-->
<!--    cancelQueue: function() {-->
<!--      // this.uploader.clearStoredFiles()-->
<!--      // this.resetQueue()-->
<!--      this.onClose()-->
<!--    },-->

<!--    /**-->
<!--     * Close dialog callback-->
<!--     */-->
<!--    onClose: function() {-->
<!--      this.$emit('update:dialogVisible', false)-->
<!--    },-->

<!--    /**-->
<!--     * Trigger input file click-->
<!--     */-->
<!--    triggerInputFile: function() {-->
<!--      this.$refs.inputFile.click()-->
<!--    },-->

<!--    /**-->
<!--     * Callback when file input has changed-->
<!--     * @param {Object} Event-->
<!--     */-->
<!--    onInputFileChange: function(e) {-->
<!--      const files = e.target.files || e.dataTransfer.files-->
<!--      if (!files || !files.length) {-->
<!--        return-->
<!--      }-->

<!--      this.transformFiles(Array.from(files))-->

<!--      // Reset file input-->
<!--      this.$refs.inputFile.value = ''-->
<!--    },-->

<!--    onDrop: function(e) {-->
<!--      if (this.isAddingFiles) {-->
<!--        // this.handleDataTransfer(e.dataTransfer || e.target).then(() => {-->
<!--        //   this.transformFiles(this.droppedFiles)-->
<!--        //-->
<!--        //   // Reset droppedFiles-->
<!--        //   this.droppedFiles = []-->
<!--        //-->
<!--        //   // Reset isDragging state-->
<!--        //   this.isDragging = false-->
<!--        // })-->
<!--      }-->
<!--    },-->

<!--    transformFiles: function(files) {-->
<!--      const fileList = files.map((file, index) => {-->
<!--        const uploadId = (this.uploadListId += 1)-->

<!--        file.uploadId = uploadId-->

<!--        return {-->
<!--          uploadId,-->
<!--          fileName: file.name,-->
<!--          size: file.size,-->
<!--          filePath: file.filePath,-->
<!--          importId: index + uuidv1(),-->
<!--          processing: true,-->
<!--          file-->
<!--        }-->
<!--      })-->

<!--      this.fileList = [...this.fileList, ...fileList]-->
<!--    },-->


<!--    /**-->
<!--     * Remove package-->
<!--     * @param {Object} item-->
<!--     */-->
<!--    removePackage: function(item) {-->
<!--      // Remove from packageList-->
<!--      const index = this.packageList.indexOf(item)-->
<!--      this.packageList.splice(index, 1)-->

<!--      // Remove from fileList-->
<!--      item.files.forEach(file => {-->
<!--        const index = findIndex(-->
<!--          propEq('uploadId', file.uploadId),-->
<!--          this.fileList-->
<!--        )-->
<!--        this.fileList.splice(index, 1)-->
<!--      })-->
<!--    },-->

<!--    /**-->
<!--     * Get fine uploader ID by uploadId-->
<!--     * @param {Object} file-->
<!--     * @param {Array} list-->
<!--     * @returns {Number}-->
<!--     */-->
<!--    getFineUploaderId: (file, list) =>-->
<!--      compose(-->
<!--        prop('id'),-->
<!--        defaultTo({}),-->
<!--        find(propEq('uploadId', file.uploadId))-->
<!--      )(list),-->

<!--    /**-->
<!--     * Cancel package upload-->
<!--     * @param {Object} item-->
<!--     */-->
<!--    cancelPackageUpload: function(item) {-->
<!--      const uploads = this.uploader.getUploads()-->
<!--      const files = propOr([], 'files', item)-->
<!--      files.forEach(file => {-->
<!--        const uploadId = this.getFineUploaderId(file, uploads)-->
<!--        this.uploader.cancel(uploadId)-->
<!--      })-->
<!--    },-->

<!--    /**-->
<!--     * Retry get packages-->
<!--     */-->
<!--    retryGetPackages: function() {-->
<!--      this.errorPreflight = ''-->
<!--      this.getPackages()-->
<!--    },-->

<!--    /**-->
<!--     * Get packages based off of files-->
<!--     * @param {Array} fileList-->
<!--     */-->
<!--    getPackages: debounce(function() {-->
<!--      /*-->
<!--      * Add dataset ID and destination ID as query params-->
<!--      * The endpoint will use this for lookups and package verification-->
<!--      */-->
<!--      const datasetId = pathOr('', ['content', 'intId'], this.dataset)-->
<!--      let dataParams = `append=false&dataset_id=${datasetId}`-->

<!--      // If uploading to a collection-->
<!--      if (this.uploadDestination.packageType !== 'DataSet') {-->
<!--        const destinationId = propOr('', 'id', this.uploadDestination)-->
<!--        dataParams += `&destinationId=${destinationId}`-->
<!--      }-->

<!--      const organizationId = pathOr(-->
<!--        '',-->
<!--        ['organization', 'id'],-->
<!--        this.activeOrganization-->
<!--      )-->
<!--      this.sendXhr(-->
<!--        `${-->
<!--          this.config.apiUrl-->
<!--        }/upload/preview/organizations/${organizationId}?${dataParams}`,-->
<!--        {-->
<!--          method: 'POST',-->
<!--          header: {-->
<!--            Authorization: `bearer ${this.userToken}`-->
<!--          },-->
<!--          body: {-->
<!--            files: this.fileList-->
<!--          }-->
<!--        }-->
<!--      )-->
<!--        .then(this.onGetPackages.bind(this))-->
<!--        .catch(this._handleGetPackagesError.bind(this))-->
<!--    }, 500),-->

<!--    /**-->
<!--     * Callback on get package preview from API-->
<!--     * @param {Object} response-->
<!--     */-->
<!--    onGetPackages: function(response) {-->
<!--      let packages = response.packages-->

<!--      // Loop through response and set each file's processing prop to false-->
<!--      packages.forEach((item, itemIndex) => {-->
<!--        item.files.forEach((file, index) => {-->
<!--          const fileListItem = find(-->
<!--            propEq('uploadId', file.uploadId),-->
<!--            this.fileList-->
<!--          )-->
<!--          fileListItem.processing = false-->
<!--          fileListItem.isUploaded = false-->
<!--          fileListItem.file.importId = item.importId-->
<!--          fileListItem.file.chunkedUpload = file.chunkedUpload-->

<!--          // Add package ID to file for lookup-->
<!--          file.importId = item.importId-->
<!--        })-->
<!--      })-->
<!--      this.packageList = this.returnSort('previewPath', packages, 'asc')-->
<!--    },-->

<!--    /**-->
<!--     * Error getting packages-->
<!--     * @param {Object} response-->
<!--     */-->
<!--    _handleGetPackagesError: function(response) {-->
<!--      if (response.status === 401) {-->
<!--        EventBus.$emit('logout')-->
<!--      } else {-->
<!--        this.errorPreflight = response.status === 429 ? 'throttle' : 'error'-->
<!--      }-->
<!--    },-->

<!--    /**-->
<!--     * show the intercom dialog-->
<!--     */-->
<!--    openIntercom: function() {-->
<!--      window.Intercom('show')-->
<!--    },-->

<!--    /**-->
<!--     * Start uploading stored files-->
<!--     */-->
<!--    startUpload: function() {-->
<!--      // Add files to fine uploader-->
<!--      this.uploader.addFiles(pluck('file', this.fileList))-->

<!--      // Add to uploadList-->
<!--      const packageList = this.packageList.slice()-->
<!--      packageList.forEach(thePackage => {-->
<!--        thePackage.uploadDestination = this.uploadDestination-->
<!--        // Set recordId and modelId properties on the package-->
<!--        if (this.modelId && this.recordId) {-->
<!--          thePackage.recordId = this.recordId-->
<!--          thePackage.modelId = this.modelId-->
<!--        }-->
<!--      })-->

<!--      this.uploadList.push(...packageList)-->

<!--      this.uploader.setCustomHeaders({-->
<!--        Authorization: `bearer ${this.userToken}`-->
<!--      })-->

<!--      // Get credentials to upload for queued files-->
<!--      // this.getCreds()-->

<!--      // Set shouldUpload flag to start upload when credentials are received-->
<!--      // this.shouldUpload = true-->

<!--      this.uploader.uploadStoredFiles()-->

<!--      // Set uploading state-->
<!--      this.$store.dispatch('updateUploadStatus', true)-->

<!--      // Add file size-->
<!--      const totalSize = sum(pluck('groupSize', packageList))-->
<!--      this.$store.dispatch('updateUploadRemainingAdd', totalSize)-->
<!--      this.$store.dispatch('updateTotalUploadSize', totalSize)-->

<!--      // Add file count-->
<!--      this.$store.dispatch('uploadCountAdd', this.fileList.length)-->

<!--      // Reset the queue-->
<!--      this.resetQueue()-->

<!--      // Change view to upload status-->
<!--      this.isAddingFiles = false-->

<!--      // Clear recordId state-->
<!--      this.recordId = ''-->
<!--    },-->

<!--    /**-->
<!--     * Reset upload queue-->
<!--     */-->
<!--    resetQueue: function() {-->
<!--      this.fileList = []-->
<!--      this.packageList = []-->
<!--      this.errorPreflight = ''-->
<!--    },-->

<!--    /**-->
<!--     * Set state to upload queue to allow user to upload more files-->
<!--     */-->
<!--    uploadMoreFiles: function() {-->
<!--      this.isAddingFiles = true-->
<!--    },-->

<!--    /**-->
<!--     * Clear out packages that have been uploaded and hide bf-upload-info-->
<!--     */-->
<!--    clearUploadedFiles: function() {-->
<!--      this.packageList = this.packageList.filter(item => !item.isUploaded)-->
<!--      this.uploadList = this.uploadList.filter(item => !item.isUploaded)-->
<!--      if (this.uploadList.length === 0) {-->
<!--        this.isAddingFiles = true-->
<!--        EventBus.$emit('dismiss-upload-info')-->
<!--      } else {-->
<!--        this.isAddingFiles = false-->
<!--      }-->
<!--    },-->

<!--    /**-->
<!--     * Get uploadList file based off of file ID-->
<!--     * @param {number} id-->
<!--     * @returns {Object}-->
<!--     */-->
<!--    getUploadListFile: function(id) {-->
<!--      const file = this.uploader.getFile(id)-->
<!--      const thePackage = find(-->
<!--        propEq('importId', file.importId),-->
<!--        this.uploadList-->
<!--      )-->
<!--      const filesArray = propOr([], 'files', thePackage)-->

<!--      return find(propEq('uploadId', file.uploadId), filesArray)-->
<!--    },-->

<!--    /**-->
<!--     * Set error state for package-->
<!--     * @param {number} packageIndex-->
<!--     */-->
<!--    _onPackageCompleteError: function(packageIndex) {-->
<!--      const updatedItem = pathOr({}, [packageIndex], this.uploadList)-->
<!--      updatedItem.error = true-->
<!--      this.uploadList.splice(packageIndex, 1, updatedItem)-->
<!--    },-->

<!--    /**-->
<!--     * Add files to queue-->
<!--     * @param {Array} files-->
<!--     */-->
<!--    addFilesToQueue: function(files) {-->
<!--      this.uploader.addFiles(files)-->
<!--    },-->

<!--    /**-->
<!--     * Sends onboarding event-->
<!--     */-->
<!--    sendOnboardingEventsRequest: function() {-->
<!--      if (this.onboardingEventsUrl) {-->
<!--        this.sendXhr(this.onboardingEventsUrl, {-->
<!--          method: 'POST',-->
<!--          body: 'AddedFile',-->
<!--          header: {-->
<!--            Authorization: `bearer ${this.userToken}`-->
<!--          }-->
<!--        })-->
<!--          .then(response => {-->
<!--            const onboardingEvents = [...this.onboardingEvents, 'AddedFile']-->
<!--            this.updateOnboardingEvents(onboardingEvents)-->
<!--          })-->
<!--          .catch(this.handleXhrError.bind(this))-->
<!--      }-->
<!--    },-->

<!--    /**-->
<!--     * Update files list when a file has completed uploading-->
<!--     * @params {Array}-->
<!--     */-->
<!--    updateFilesList: function(response) {-->
<!--      response.forEach(item => {-->
<!--        // add package dto to each item in uploadList-->
<!--        const uploadListPkg = find(-->
<!--          propEq('importId', item.manifest.importId),-->
<!--          this.uploadList-->
<!--        )-->

<!--        // Add file to files list if uploading to current collection-->
<!--        const packageDTO =-->
<!--          uploadListPkg.previewPath === null-->
<!--            ? propOr({}, 'package', item)-->
<!--            : pathOr({}, ['package', 'parent'], item)-->

<!--        EventBus.$emit('add-uploaded-file', {-->
<!--          packageDTO,-->
<!--          uploadDestination: this.uploadDestination-->
<!--        })-->

<!--        uploadListPkg.package = item.package-->
<!--      })-->
<!--    }-->
<!--  },-->

<!--  mounted: function() {-->
<!--    let customheaders = {}-->

<!--    // Set header if userToken is available-->
<!--    if (this.userToken) {-->
<!--      customheaders = {-->
<!--        Authentication: `bearer ${this.userToken}`-->
<!--      }-->
<!--    }-->

<!--  }-->
<!--}-->
<!--</script>-->

<style scoped lang="scss">
@import '../../assets/_variables.scss';

.bf-upload .bf-dialog .bf-dialog-wrap {
  height: 590px;
  margin: -295px 0 0 -350px;
  width: 700px;
}
</style>
