<template>
  <bf-stage
    ref="bfStage"
  >
    <!-- update dataset -->
    <el-row>
      <el-col>
        <el-form
          ref="updateDatasetForm"
          class="dataset-search-form"
          label-position="top"
          :model="form"
          :rules="rules"
          @submit.native.prevent
        >
          <el-form-item
            prop="name"
            class="mb-24"
          >
            <template #label>
              Name
              <span class="label-helper">
                required
              </span>
            </template>
            <el-input
              v-model="form.name"
              :disabled="datasetLocked"
              :maxlength="255"
              @input="submitUpdateDatasetRequest"
            />
          </el-form-item>

          <el-form-item
            id="inputDescription"
            prop="description"
            class="mb-24"
          >
            <template #label>
              Subtitle
              <span class="label-helper">
                required to publish
              </span>
            </template>
            <character-count-input
              ref="inputDescription"
              v-model="form.description"
              :rows="5"
              placeholder="Add a description to help others understand what's in your dataset"
              :disabled="datasetLocked"
              @input="onUpdateDescription"
            />
          </el-form-item>

          <el-form-item id="inputTags">
            <template #label>
              Tags
            </template>
            <el-input
              ref="inputTags"
              v-model="inputTag"
              class="mb-8"
              placeholder="Add tags"
              :disabled="datasetLocked"
              @keyup.enter.native.stop="addTag"
            >
              <template #prefix>
                <IconTag
                  :height="20"
                  :width="20"
                  />
              </template>
            </el-input>

            <div class="tag-wrap">
              <bf-tag
                v-for="tag in form.tags"
                :key="tag"
                :label="tag"
                class="mr-8 mb-8"
                @remove="removeTag(tag)"
              />
            </div>
          </el-form-item>
        </el-form>
      </el-col>
    </el-row>

    <hr>

    <dataset-license
      id="inputLicense"
      @change-license="submitUpdateDatasetRequest"
    />

    <dataset-settings-banner-image
      id="bannerImage"
      ref="bannerImage"
      :dataset = "dataset"
      :datasetBannerURL = "datasetBanner"
      :isLoadingBanner="isLoadingDatasetBanner"
    />

    <hr>

    <dataset-settings-collections />

    <hr>

    <dataset-settings-associated-publications/>

    <hr>

    <!-- delete dataset -->
    <el-row>
      <el-col>
        <h2 class="delete-title">
          Delete Dataset
        </h2>
        <p>
          Deleting a dataset removes all data from Pennsieve.
          <strong>This cannot be undone.</strong>
        </p>
        <p class="mb-20">
          Datasets that are published to Pennsieve Discover must be removed before they can be deleted.
        </p>
        <bf-button
          class="red"
          :disabled="datasetLocked || !getPermission('owner') || datasetPublished"
          @click="onDeleteDatasetBtnClick"
        >
          Delete
        </bf-button>
        <p
          v-if="!getPermission('owner')"
          class="sharing-blurb"
        >
          Deleting is restricted to owners only. To change the owner of your dataset, please contact
          <a
            :href="`mailto:${datasetOwnerEmail}`"
          >
            {{ datasetOwnerName }}
          </a>
        </p>
      </el-col>
    </el-row>

    <delete-dataset
      ref="deleteDatasetDialog"
      :dialog-visible="deleteDatasetDialogVisible"
      @delete-dataset-confirmed="submitDeleteDatasetRequest"
      @close="onCloseDeleteDialog"
    />
  </bf-stage>
  <stale-update-dialog
      :dialog-visible = "staleUpdateDialogVisible"
      @close="staleUpdateDialogClose"
    />
</template>

<script>
  import {mapActions, mapGetters, mapState} from 'vuex'
  import {clone, compose, includes, defaultTo, equals, not, path, pathOr, pick, propOr, toLower, trim} from 'ramda'
  import debounce from 'lodash.debounce'


  import BfRafter from '../../shared/bf-rafter/BfRafter.vue'
  import BfButton from '../../shared/bf-button/BfButton.vue'
  import CharacterCountInput from '../../shared/CharacterCountInput/CharacterCountInput.vue'
  import DeleteDataset from './window/DeleteDataset.vue'
  import DatasetSettingsAssociatedPublications from './DatasetSettingsAssociatedPublications/DatasetSettingsAssociatedPublications.vue'
  import DatasetSettingsCollections from './DatasetSettingsCollections/DatasetSettingsCollections.vue'
  import DatasetLicense from './DatasetLicense/DatasetLicense.vue'
  import FormatDate from '../../../mixins/format-date'
  import Request from '../../../mixins/request'
  import DeleteDatasetMixin from '../../../mixins/DeleteDataset'
  import CheckUniqueNames from '../../../mixins/check-unique-names'
  import SanitizeName from '../../../mixins/sanitize-name'
  import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue'
  import BfTag from '../../shared/BfTag/BfTag.vue'


  import licenses from './dataset-licenses'
  import StaleUpdateDialog from "../stale-update-dialog/StaleUpdateDialog.vue";
  import LockedBanner from '../LockedBanner/LockedBanner.vue';
  import IconLockFilled from "../../icons/IconLockFilled.vue";

export default {
  name: 'BfDatasetSettings',

  components: {
    IconLockFilled,
    BfRafter,
    BfButton,
    DeleteDataset,
    CharacterCountInput,
    BfEmptyPageState,
    DatasetLicense,
    StaleUpdateDialog,
    LockedBanner,
    DatasetSettingsAssociatedPublications,
    DatasetSettingsCollections,
    BfTag
  },

  mixins: [
    Request,
    CheckUniqueNames,
    SanitizeName,
    DeleteDatasetMixin,
    FormatDate
  ],

  props: {
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      form: {
        name: '',
        description: '',
        license: '',
        tags: []
      },
      inputTag: '',
      rules: {
        name: [
          {
            validator: this.validateDatasetName,
            trigger: 'false'
          }
        ]
      },
      deleteDatasetDialogVisible: false,
      dialogDescriptionVisible: false,
      dialogReleaseNewVisible: false,
      staleUpdateDialogVisible: false,
      licenses
    }
  },

  computed: {
    ...mapState([
      'concepts',
      'datasetEtag',
      'dataset',
      'datasets',
      'datasetBanner',
      'isLoadingDatasetBanner'
    ]),

    ...mapGetters([
      'activeOrganization',
      'config',
      'hasFeature',
      'getPermission',
      'datasetOwner',
      'datasetLocked'
    ]),

    /**
     * Returns the full dataset owner name
     */
    datasetOwnerName: function() {
      const firstName = propOr('', 'firstName', this.datasetOwner)
      const lastName = propOr('', 'lastName', this.datasetOwner)
      return `${firstName} ${lastName}`
    },

    datasetPublished: function() {
      return this.dataset.publication
        && !!this.dataset.publication.publishedDataset
    },

    /**
     * Returns the dataset owner email
     */
    datasetOwnerEmail: function() {
      return propOr('', 'email', this.datasetOwner)
    },

    /**
     * Compute if the user has permission to see the settings page
     * @returns {Boolean}
     */
    hasPermission: function() {
      return this.getPermission('manager')
    },

    /**
     * Compute dataset name
     * @returns {String}
     */
    datasetName: function() {
      return pathOr('Dataset', ['content', 'name'])(this.dataset)
    }
  },

  watch: {
    dataset: {
      handler: function(dataset) {
        this.setFormData(dataset)
        this.scrollToInput()
      },
      deep: true,
      immediate: true
    },
    hasPermission: {
      handler: function(hasPermission) {
        if (hasPermission) {
          this.$nextTick(() => {
            this.scrollToInput()
          })
        }
      },
      immediate: true
    }
  },

  methods: {
    ...mapActions(['updateDataset', 'setDatasetEtag']),

    onUpdateDescription: function(description) {
      this.form.description = description
      this.submitUpdateDatasetRequest()
    },
    /**
     * Makes XHR call to update a dataset
     */
    submitUpdateDatasetRequest:  debounce( function() {
      this.$refs.updateDatasetForm.validate(async valid => {
        // only the name field is validated in this form.  if it is invalid, remove it from he payload.
        // eslint-disable-next-line no-unused-vars
        const { name, ...rest } = this.form
        const body = valid ? this.form : rest
        let datasetUrl = await this.datasetUrl;
        fetch(datasetUrl, {
          method:'PUT',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            'If-Match': this.datasetEtag
          }
        }).then(response => {
          if (response.ok) {
            response.json().then(updatedDataset => {
              this.setDatasetEtag(response.headers.get('etag'))
              this.updateDataset({ ...this.dataset, ...updatedDataset })
            })
          } else if (response.status === 412) {
            this.staleUpdateDialogVisible = true;
          } else {
            throw response
          }
        }).catch(this.handleXhrError.bind(this))
      })

    }, 1000),

    /**
     * Alert the user there are unsaved changes and they will be lost.
     * @returns {Boolean}
     */
    checkSettingsChanges: function() {
      const isNameChanged = this.checkIsSettingChanged(
        ['name'],
        ['content', 'name']
      )
      const isSubtitleChanged = this.checkIsSettingChanged(
        ['description'],
        ['content', 'description']
      )
       const isLicenseChanged = this.checkIsSettingChanged(
        ['license'],
        ['content', 'license']
      )

      const isTagsChanged = this.checkIsSettingChanged(
        ['tags'],
        ['content', 'tags']
      )

      const hasChanges = includes(true, [
        isNameChanged,
        isSubtitleChanged,
        isLicenseChanged,
        isTagsChanged
      ])

      return hasChanges
    },

    /**
     * Check if the subtitle has been changed
     * @return {Boolean}
     */
    checkIsSettingChanged: function(formPath, datasetPath) {
      const formItem = pathOr('', formPath, this.form)
      const datasetItem = pathOr('', datasetPath, this.dataset)

      return not(equals(formItem, datasetItem))
    },

    /**
     * Close StaleUpdateDialog
     * @return {Boolean}
     */
    staleUpdateDialogClose: function() {
      this.staleUpdateDialogVisible = false
    },

    /**
     * Scroll to input if necessary
     */
    scrollToInput: function() {
      const focusInput = path(['query', 'focusInput'], this.$route)
      if (focusInput && this.$el) {
        const scrollToEl = this.$el.querySelector(`#${focusInput}`)
        if (scrollToEl) {
          scrollToEl.scrollIntoView()

          const input = this.$refs[focusInput]
          if (input) {
            input.focus()
          }

          // Remove query
          this.$router.replace({ query: {} })
        }
      }
    },

    /**
     * Validator for dataset name
     * @param {Object} rule
     * @param {String} value
     * @param {Function} callback
     */
    validateDatasetName(rule, value, callback) {
      const isUnique = this.checkUniqueName(
        this.datasets,
        ['content', 'name'],
        value,
        '',
        false
      )
      const datasetName = pathOr('', ['content', 'name'])(this.dataset)
      const hasReservedChars = this.containsReservedChars(value)
      if (!value) {
        callback(new Error('Please provide a name'))
      } else if (value.length > 255) {
        callback(new Error('Dataset name must be less than 255 characters'))
      } else if (hasReservedChars) {
        callback(
          new Error(
            `A dataset name cannot contain any of the following characters: ${
              this.reservedCharsStr
            }`
          )
        )
      } else if (value === datasetName) {
        callback()
      } else if (isUnique === false) {
        callback(new Error('Please provide unique name'))
      } else {
        callback()
      }
    },
    /**
     * Update dataset form data
     */
    setFormData: function(dataset) {
      const data = compose(
        clone,
        pick([
          'name',
          'description',
          'license',
          'tags'
        ]),
        propOr({}, 'content')
      )(dataset)

      this.form = data
    },

    /**
     * Handle delete dataset btn click
     */
    onDeleteDatasetBtnClick: function() {
      this.deleteDatasetDialogVisible = true
    },
    onCloseDeleteDialog: function() {
      this.deleteDatasetDialogVisible = false
    },

    /**
     * Close description dialog
     * Focus on the description input
     */
    closeDescriptionDialog: function() {
      this.dialogDescriptionVisible = false
      this.$refs.inputDescription.focus()
    },

    /**
     * Show intercom window
     */
    showIntercom: function() {
      // window.Intercom('show')
    },

    /**
     * Check if the tag exists
     * @param {String} tag
     * @returns {Boolean}
     */
    checkIfTagExists: function(tag) {
      const formTags = propOr([], 'tags', this.form)
      const tagExistsForm = includes(tag, formTags)

      const datasetTags = pathOr([], ['dataset', 'tags'], this.dataset)
      const tagExistsDataset = includes(tag, formTags)

      return tagExistsForm || tagExistsDataset
    },

    /**
     * Add tag to the dataset
     */
    addTag: function() {
      const tag = compose(
        trim,
        toLower,
        defaultTo('')
      )(this.inputTag)

      if (tag) {
        this.inputTag = ''

        const tagExists = this.checkIfTagExists(tag)
        if (tagExists === false) {
          this.form.tags.push(tag)
          this.submitUpdateDatasetRequest()
        }
      }
    },

    /**
     * Remove tag from datsaet
     * @params {String} tag
     */
    removeTag: function(tag) {
      const idx = this.form.tags.indexOf(tag)
      this.form.tags.splice(idx, 1)
      this.submitUpdateDatasetRequest()
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../assets/_variables';

.settings-wrapper {
  height:100%;
}

.flex-heading {
  color: $white;
  margin-bottom: 8px;
}

.bf-dataset-settings {
  background: $white;
}

.el-form-item,
.dataset-settings-collections {
  max-width: 475px;
}
.el-form-item__label {
  width: 100%;
}

.el-select {
  width: 100%;
}

hr {
  margin: 32px 0 24px;
}

.full-width {
  margin: 32px -32px 24px -32px;
  height: 2px;
}

.mb-20 {
  margin-bottom: 16px;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
}

.tab-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.sharing-blurb {
  color: $gray_4;
  margin-top: 11px;
  height: 16px;
  font-weight: normal;
  font-size: 14px;
}
</style>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';
.bf-dataset-settings {
  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: $gray_6;
  }
}

.delete-title {
  font-size: 14px;
  color: $gray_6;
  margin-top: 20px;
}

h4 {
  margin-bottom: 8px;
}
</style>
