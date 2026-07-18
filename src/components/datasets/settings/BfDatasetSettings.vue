<template>
  <bf-stage
    ref="bfStage"
  >
    <div class="details-container">
      <div class="settings-section">
        <div class="settings-section-header">Basic Information</div>
        <div class="settings-section-content">
          <el-form
            ref="updateDatasetForm"
            label-position="top"
            :model="form"
            :rules="rules"
            @submit.native.prevent
          >
            <el-form-item prop="name">
              <template #label>
                Name
                <span class="label-required">*</span>
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
            >
              <template #label>
                Subtitle
              </template>
              <character-count-input
                ref="inputDescription"
                v-model="form.description"
                :rows="4"
                placeholder="A brief description to help others understand your dataset"
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
                placeholder="Add a tag and press Enter, or search standard ontology terms"
                :disabled="datasetLocked"
                @keyup.enter.native.stop="addTag"
                @input="onTagInput"
              >
                <template #prefix>
                  <IconTag :height="16" :width="16" />
                </template>
              </el-input>
              <!-- Ontology term suggestions (MONDO/HPO/UBERON/NCIt): pick one to add a
                   standardized tag. Silently empty until slices are published / when
                   offline, so free-text tagging always works. -->
              <ul
                v-if="conceptResults.length && inputTag.trim()"
                class="concept-suggestions"
              >
                <li
                  v-for="c in conceptResults"
                  :key="c.curie"
                  @click="addConceptTag(c)"
                >
                  <span class="concept-label">{{ c.label }}</span>
                  <span class="concept-meta">{{ c.ontology }} · {{ c.curie }}</span>
                </li>
              </ul>
              <div v-if="form.tags.length > 0" class="tag-wrap">
                <bf-tag
                  v-for="tag in form.tags"
                  :key="tag"
                  :label="tag"
                  @remove="removeTag(tag)"
                />
              </div>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">Banner Image</div>
        <div class="settings-section-content">
          <dataset-settings-banner-image
            id="bannerImage"
            ref="bannerImage"
            :dataset="dataset"
            :datasetBannerURL="datasetBanner"
            :isLoadingBanner="isLoadingDatasetBanner"
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">Collections</div>
        <div class="settings-section-content">
          <dataset-settings-collections />
        </div>
      </div>
    </div>
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
  import DatasetSettingsContributors from './DatasetSettingsContributors/DatasetSettingsContributors.vue'
  import DatasetLicense from './DatasetLicense/DatasetLicense.vue'
  import FormatDate from '../../../mixins/format-date'
  import Request from '../../../mixins/request'
  import DeleteDatasetMixin from '../../../mixins/DeleteDataset'
  import CheckUniqueNames from '../../../mixins/check-unique-names'
  import SanitizeName from '../../../mixins/sanitize-name'
  import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue'
  import BfTag from '../../shared/BfTag/BfTag.vue'
  import { useOntologyStore } from '@/stores/ontologyStore'


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
    DatasetSettingsContributors,
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
      conceptResults: [],
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
        this.conceptResults = []

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
    },

    /**
     * As the user types a tag, search the published ontology slices for standard
     * terms to suggest (debounced). Degrades silently to free-text tagging when
     * the slices aren't published or the browser is offline.
     */
    onTagInput: function() {
      if (!this.inputTag.trim()) {
        this.conceptResults = []
        return
      }
      if (!this.debouncedConceptSearch) {
        this.debouncedConceptSearch = debounce(this.doConceptSearch, 200)
      }
      this.debouncedConceptSearch()
    },

    doConceptSearch: async function() {
      const q = this.inputTag.trim()
      if (!q) {
        this.conceptResults = []
        return
      }
      try {
        const rows = await useOntologyStore().search(q, { limit: 8 })
        // Dataset tags: drop UCUM units (irrelevant for describing a dataset).
        this.conceptResults = (rows || []).filter((r) => r.ontology !== 'UCUM')
      } catch (e) {
        this.conceptResults = [] // slices unpublished / offline — free-text still works
      }
    },

    /**
     * Add a standardized tag from a picked ontology term (reuses addTag's
     * normalization + dedup + save; Level 1 stores the label string).
     */
    addConceptTag: function(term) {
      this.inputTag = term.label
      this.conceptResults = []
      this.addTag()
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';
@use '../../../styles/element/input';

.details-container {
  max-width: 640px;
}

// Ontology term suggestions under the tags input (ONT-2).
.concept-suggestions {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  max-height: 240px;
  overflow-y: auto;

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;

    &:hover {
      background: theme.$gray_1;
    }

    & + li {
      border-top: 1px solid theme.$gray_1;
    }
  }

  .concept-label {
    font-size: 14px;
  }

  .concept-meta {
    flex-shrink: 0;
    font-size: 12px;
    color: theme.$gray_5;
  }
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_5;
  padding: 8px 0;
  margin: 0 0 16px;
  border-bottom: 1px solid theme.$gray_2;
}

.settings-section-content {
  padding-bottom: 0;
}

:deep(.el-form-item) {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

:deep(.el-form-item__label) {
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}

:deep(.el-select) {
  width: 100%;
}

.label-required {
  color: theme.$red_1;
  margin-left: 2px;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

h4 {
  margin-bottom: 8px;
}
</style>
