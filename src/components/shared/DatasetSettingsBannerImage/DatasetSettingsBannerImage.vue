<template>
  <div
    class="dataset-settings-banner-image"
  >
    <hr>
    <h4>Banner Image</h4>
    <p class="mb-16">
      Image needs to be either jpg, gif, or png.
    </p>
    <div
      class="mb-8 add-image-wrap"
      :class="{ 'is-dragging': isDragging }"
      @click="openImageSelector"
      @dragenter="setIsDragging(true)"
      @dragover.prevent="setIsDragging(true)"
      @dragleave="setIsDragging(false)"
      @drop.prevent="setImage($event, true)"
    >
      <dataset-banner
      class="img-banner"
      :dataset = "dataset"
      :datasetBannerURL = "datasetBannerURL"
      :isLoadingBanner="isLoadingBanner"
      />
    </div>

    <p
      v-if="!isValid"
      class="invalid-image-type"
    >
      {{ invalidImageErrorMessage }}
    </p>

    <a
      v-if="!datasetLocked"
      href="#"
      @click="openImageSelector"
    >
      {{ uploadText }}
    </a>
    (2048x2048 pixels)

    <input
      v-show="false"
      ref="inputFile"
      type="file"
      :accept="validPickerTypes"
      multiple="false"
      @change="setImage"
    >

    <el-dialog
      v-model="isDialogVisible"
      :show-close="false"
      :close-on-click-modal="false"
      @closed="closeDialog"
    >
      <template #header>
        <bf-dialog-header
          title="Update banner image"
        />
      </template>

      <dialog-body>
        <div
          v-loading="isLoadingImage"
          class="cropper-wrap"
        >
          <img
            ref="img"
            src=""
          >
        </div>
      </dialog-body>

      <template #footer>
        <bf-button
          class="secondary"
          @click="isDialogVisible = false"
        >
          Cancel
        </bf-button>
        <bf-button
          :processing="isUploadingBanner"
          processing-text="Saving"
          @click="saveBanner"
        >
          Save
        </bf-button>
      </template>

    </el-dialog>
  </div>
</template>

<script>
  import {
    mapActions, mapGetters,
    mapState, mapMutations
  } from 'vuex';
  import {
    head,
    pathOr,
    propOr
  } from 'ramda'
  import Cropper from 'cropperjs'
  import 'cropperjs/dist/cropper.css'


  import {useGetToken} from "@/composables/useGetToken";
  import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
  import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";
  import BfButton from "@/components/shared/bf-button/BfButton.vue";
  import DatasetBanner from "@/components/shared/DatasetBanner/DatasetBanner.vue";

  export default {
    name: 'DatasetSettingsBannerImage',
    components: {DatasetBanner, BfButton, DialogBody, BfDialogHeader},

    props: {
      dataset: {
        type: Object,
        default: {}
      },
      datasetBannerURL: {
        type: String,
        default: '',
      },
      isLoadingBanner: {
        type: Boolean,
        default: true
      },
      isCodeReposDataset: {
        type: Boolean,
        default: false
      }
    },

    data() {
      return {
        isDialogVisible: false,
        selectedImage: File,
        cropper: {},
        isLoadingImage: true,
        isDragging: false,
        selectedImageFile: null,
        isUploadingBanner: false,
        validImageTypes: [
          {
            type: 'image/jpeg',
            name: 'JPEG'
          },
          {
            type: 'image/png',
            name: 'PNG'
          },
          {
            type: 'image/gif',
            name: 'GIF'
          }
        ],
        isValid: true
      }
    },

    computed: {
      ...mapState([
        'config',
        'dataset',
        'datasetBanner'
      ]),

      ...mapGetters(['datasetLocked']),

      /**
       * Compute if the dataset has a banner
       * @returns {Boolean}
       */
      hasDatasetBanner: function() {
        return this.datasetBannerURL !== ''
      },

      /**
       * Compute upload text based on if the
       * dataset has a banner
       * @returns {String}
       */
      uploadText: function() {
        return this.hasDatasetBanner
          ? 'Replace Image'
          : 'Upload Banner Image'
      },

      /**
       * Invalid image type error message including
       * all accepted image types.
       * @returns {String}
       */
      invalidImageErrorMessage: function() {
        const types = this.validImageTypes.map(type => type.name).join(', ') + ' or JPG'
        return `Invalid file type. Please input a ${types} file.`
      },

      /**
       * List of valid filetypes as a string
       * for the file picker.
       * @returns {String}
       */
      validPickerTypes: function() {
        return this.validImageTypes.map(el => el.type).join(',')
      }
    },

    methods: {
      ...mapActions([
        'setDatasetBanner'
      ]),

      ...mapMutations({
        setCodeRepoDatasetBanner: 'codeReposModule/SET_CODE_REPO_BANNER_URL'
      }),

      /**
       * Set isDragging
       * @param {Boolean} isDragging
       */
      setIsDragging: function(isDragging) {
        this.isDragging = isDragging
      },

      /**
       * On open of the dialog, set loading state
       * and trigger click on the hidden file input
       */
      openImageSelector: function() {
        this.$refs.inputFile.click()
      },

      /**
       * Close and reset the dialog
       */
      closeDialog: function() {
        this.isDialogVisible = false
        this.isUploadingBanner = false
        this.$refs.img.src = ''
        this.$refs.inputFile.value = ''
        this.selectedImageFile = null
        if (Object.keys(this.cropper).length) {
          this.cropper.destroy()
        }
      },

      /**
       * Save banner image
       */
      saveBanner: function() {
        this.isUploadingBanner = true
        this.cropper.getCroppedCanvas({
          fillColor: '#fff'
        }).toBlob((blob) => {
          const datasetId = pathOr('', ['content', 'id'], this.dataset)
          const datasetIntId = pathOr('', ['content', 'intId'], this.dataset)
          const imageName = this.selectedImageFile.name
          //const blob = this.selectedImageFile.webkitRelativePath;

          const formData = new FormData()
          formData.append('banner', blob, `dataset_banner_${datasetIntId}.jpg`)

          useGetToken()
            .then(token => {
              const url = `${this.config.apiUrl}/datasets/${datasetId}/banner?api_key=${token}`
              fetch(url, {
                method: 'PUT',
                body: formData
              })
                .then(response => {
                  return response.json()
                })
                .then((r) => {

                  if(this.isCodeReposDataset) {
                    this.setCodeRepoDatasetBanner(r)
                    this.isDialogVisible = false;
                    this.isUploadingBanner = false
                  } else {
                    this.setDatasetBanner(r.banner)
                      .then(() => {
                        this.isDialogVisible = false
                        this.isUploadingBanner = false
                      })
                    }
                })
            }).finally(() => {
                this.isUploadingBanner = false
              })
        }, 'image/jpeg', 0.7)
      },

      /**
       * Check that the drag & dropped image is a valid type
       * @param {Object}
       * @returns {Boolean}
       */
      isValidImage: function(image) {
        const fileType = image.type || ''
        return this.validImageTypes.some(imageType => fileType.includes(imageType.type))
      },

      /**
       * Set the image the user has selected
       * and initialize Cropper.js
       */
      setImage: function(evt, isDropping = false) {
        this.isDragging = false
        this.$nextTick(() => {
          this.isLoadingImage = true
        })

        const files = isDropping
          ? evt.dataTransfer.files
          : this.$refs.inputFile.files

        const image = head(files)
        image.path = this.$refs.inputFile.value
        this.isValid = this.isValidImage(image)
        if (this.isValid) {
          this.isDialogVisible = true
          const reader  = new FileReader()

          reader.addEventListener('load', () => {
            this.$refs.img.src = reader.result
            this.initCropper()
          }, false)

          if (image) {
            this.selectedImageFile = image
            reader.readAsDataURL(image)
          }
        }
      },

      /**
       * Initialize Cropper.js
       */
      initCropper: function() {
        this.cropper = new Cropper(this.$refs.img, {
          aspectRatio: 1,
          responsive: false,
          viewMode: 2
        })

        this.isLoadingImage = false
      },

      focus: function() {
        this.$emit('focus')
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../assets/_variables.scss';

  .add-image-wrap {
    align-items: center;
    color: $gray_4;
    cursor: pointer;
    display: flex;
    font-size: 12px;
    height: 256px;
    justify-content: center;
    text-align: center;
    width: 256px;
  }

  .img-banner {
    height: 100%;
    width: 100%;
  }

  .cropper-wrap {
    background: $gray_1;
    height: 476px;
    width: 476px;
  }
  .cropper-wrap img {
    max-width: 100%;
  }

  .invalid-image-type {
    color: red;
  }
</style>
