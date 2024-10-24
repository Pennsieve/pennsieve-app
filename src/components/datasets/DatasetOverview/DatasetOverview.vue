<template>
  <div>
    <locked-banner slot="banner" />

    <bf-rafter  class="overview">
      <template #heading>
        <div
          class="flex-heading"
        >
          <div class="dataset-heading">
            <dataset-banner
              empty-state-text="Add a banner image."
              @click.native="goToBanner"
            />

            <div class="dataset-heading-info">
              <h1 class="mb-8">
                {{ datasetName }}
              </h1>

              <div class="dataset-owners">
                <div
                  v-for="(contributor, idx) in datasetContributorsList"
                  :key="contributor.id"
                  class="contributor-item-wrap"
                >
                  <contributor-item :contributor="contributor" />
                  <template v-if="idx < datasetContributorsList.length - 1">
                    ,
                  </template>
                </div>
              </div>

              <!-- eslint-disable vue/no-v-html -->
              <!-- $sanitize will sanitize the HTML injected -->
              <div
                class="dataset-description mb-24"
                v-html="$sanitize(datasetSubtitle)"
              ></div>

              <div class="dataset-heading-meta">
                Last updated on <strong>{{ lastUpdatedDate }}</strong>
                <template v-if="isPublished && publishedCount > 0">
                  (<a
                  :href="discoverLink"
                  target="_blank"
                >
                  Version {{ publishedVersionLabel }}
                </a>)
                  <div class="sharing-status">

                    Last published on <strong>{{ publishedDate }}</strong>
                    <a
                      target="_blank"
                      :href="discoverLink"
                      class="discover-link"
                    >
                      View on Discover
                    </a>
                  </div>

                  <div class="sharing-status">
                    Published dataset DOI: <a :href="doiUrl">{{datasetDoi.doi}}</a>
                  </div>
                </template>
                <!-- <div class="dataset-corresponding-contributor">
                  <p>Dataset owner:</p>
                  <contributor-item :contributor="correspondingContributor" />
                </div> -->
              </div>
              <div class="dataset-heading-cta">
                <span>Dataset node id </span>
                <span><strong>{{ datasetNodeId }}</strong></span>
                <button @click="copyToClipboard(datasetNodeId)">
                  <IconCopyDocument/>
                </button>
              </div>
            </div>
          </div>

          <div class="dataset-info-stats">
            <div class="dataset-info-stat">
              <IconFiles
                class="svg-icon"
                :height="20"
                :width="20"
                color="white"
              />
              <div>
                <strong>{{ packageTypeCount }}</strong>
                  <router-link :to="{ name: 'dataset-files' }">
                    Files
                  </router-link>
              </div>
            </div>
            <div class="dataset-info-stat">
              <IconStorage
                class="svg-icon"
                :height="20"
                :width="20"
              />
              <div>
                <strong>{{ datasetStorage.number }}</strong>
                {{ datasetStorage.unit }}
              </div>
            </div>
            <div class="dataset-info-stat">
              <IconDocument
                class="svg-icon"
                :height="20"
                :width="20"
              />
              <div>
                <strong>{{ totalRecordsCount.toLocaleString('en') }}</strong>
                <!--                  <router-link :to="{ name: 'records' }">-->
                <!--                    {{ totalRecordsCountLabel }}-->
                <!--                  </router-link>-->
              </div>
            </div>
            <div class="dataset-info-stat">
              <IconLicense
                class="svg-icon"
                :height="20"
                :width="20"
              />
              <div>
                  <router-link
                    :to="{
                      name: 'dataset-settings',
                      query: {
                        focusInput: 'inputLicense'
                      }
                    }"
                  >
                    {{ datasetLicense }}
                  </router-link>
              </div>
            </div>
          </div>
        </div>

      </template>
    </bf-rafter>

    <bf-stage>

      <data-card
        ref="descriptionDataCard"
        class="grey compact"
        title="Description"
        :is-expandable="true"
        :padding="false"
      >
        <template #title-aux>
          <button
            v-if="isEditingMarkdownDescription
"
            class="linked mr-8"
            @click="isEditingMarkdownDescription
 = false"
          >
            Cancel
          </button>
          <button
            v-if="isEditingMarkdownDescription
"
            class="linked"
            :disabled="datasetLocked"
            @click="isSavingMarkdownDescription = true"
          >
            Save
          </button>

          <button
            v-else
            slot="title-aux"
            class="linked-9"
            :disabled="datasetLocked"
            @click="isEditingMarkdownDescription
 = true"
          >
            Update
          </button>
        </template>

        <markdown-editor
          ref="markdownEditor"
          :value="datasetDescription"
          :is-editing="isEditingMarkdownDescription
"
          :is-saving="isSavingMarkdownDescription"
          :empty-state="datasetDescriptionEmptyState"
          :is-loading="isLoadingDatasetDescription"
          @save="onReadmeSave"
        />
      </data-card>
      <br>
      <data-card
        ref="changelogDataCard"
        class="grey compact"
        title="Changelog"
        :is-expandable="true"
        :padding="false"
      >
        <template #title-aux>
          <button
            v-if="isEditingMarkdownChangelog
"
            class="linked mr-8"
            @click="isEditingMarkdownChangelog
 = false"
          >
            Cancel
          </button>
          <button
            v-if="isEditingMarkdownChangelog
"
            class="linked"
            @click="isSavingMarkdownChangelog = true"
          >
            Save
          </button>
          <button
            v-else
            slot="title-aux"
            class="linked-9"
            :disabled="datasetLocked"
            @click="isEditingMarkdownChangelog
 = true"
          >
            Update
          </button>
        </template>
        <markdown-editor
          ref="markdownEditor"
          :value="changelogText"
          :is-editing="isEditingMarkdownChangelog
"
          :is-saving="isSavingMarkdownChangelog"
          :empty-state="changelogDescriptionEmptyState"
          @save="onChangelogSave"

        />
      </data-card>

    </bf-stage>

    <stale-update-dialog
      ref="staleUpdateDialog"
      :dialog-visible = "staleUpdateDialogVisible"
      @close="staleUpdateDialogClose"
    />
  </div>


</template>

<script>
  import {mapActions, mapGetters, mapState} from 'vuex'
  import Cookie from 'js-cookie'
  import {compose, defaultTo, head, last, pathOr, propOr, split, sum, values} from 'ramda'

  import DataCard from '../../shared/DataCard/DataCard.vue'
  import ChecklistItem from '../../shared/ChecklistItem/ChecklistItem.vue'
  import MarkdownEditor from '../../shared/MarkdownEditor/MarkdownEditor.vue'

  import BfStorageMetrics from '../../../mixins/bf-storage-metrics/index'
  import FormatDate from '../../../mixins/format-date/index'
  import Request from '../../../mixins/request'
  import DatasetPublishedData from '../../../mixins/dataset-published-data'

  import datasetDescriptionEmptyState from './dataset-description-empty-state'
  import changelogDescriptionEmptyState from './changelog-description-empty-state'
  import ContributorItem from '../ContributorItem/ContributorItem.vue'
  import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
  import BfButton from "../../shared/bf-button/BfButton.vue";
  import StaleUpdateDialog from "../stale-update-dialog/StaleUpdateDialog.vue";
  import LockedBanner from '../LockedBanner/LockedBanner.vue';
  import IconFiles from "../../icons/IconFiles.vue";
  import IconStorage from "../../icons/IconStorage.vue";
  import IconDocument from "../../icons/IconDocument.vue";
  import IconLicense from "../../icons/IconLicense.vue";
  import IconCopyDocument from "../../icons/IconCopyDocument.vue";
  import EventBus from '../../../utils/event-bus';


  const replaceLineBreaks = str => {
  return Object.prototype.toString.call(str) === '[object String]'
    ? str.replace(/(\r\n|\n|\r)/g, '<br>')
    : str
}

const getDismissedDatasetChecklist = () =>
  compose(
    JSON.parse,
    defaultTo('[]')
  )(Cookie.get('dismissedDatasetChecklist'))

export default {
  name: 'DatasetOverview',

  components: {
    IconLicense,
    IconDocument,
    IconStorage,
    IconFiles,
    IconCopyDocument,
    LockedBanner,
    ChecklistItem,
    DataCard,
    MarkdownEditor,
    ContributorItem,
    BfRafter,
    BfButton,
    StaleUpdateDialog
  },

  mixins: [BfStorageMetrics, FormatDate, Request, DatasetPublishedData],

  props: {
    datasetId: {
      type: String,
      default: ''
    },
    orgId: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      isChecklistDimissed: false,
      isEditingMarkdownDescription: false,
      isEditingMarkdownChangelog: false,
      isSavingMarkdownDescription: false,
      isSavingMarkdownChangelog: false,
      datasetDescriptionEmptyState,
      changelogDescriptionEmptyState,
      packageTypeCount: 0,
      isDialogVisible: false,
      staleUpdateDialogVisible: false
    }
  },

  computed: {
    ...mapGetters([
      'totalRecordsCount',
      'getPermission',
      'datasetOwner',
      'datasetOwnerHasOrcidId',
      'datasetLocked',
      'isOrgSynced'
    ]),

    ...mapState([
      'config',
      'concepts',
      'dataset',
      'datasetBanner',
      'isLoadingDatasetBanner',
      'isDatasetOwner',
      'userToken',
      'config',
      'datasetDescription',
      'changelogText',
      'datasetDescriptionEtag',
      'datasetDoi',
      'datasetRole',
      'isLoadingDatasetDescription',
      'datasetContributors',
      'activeOrganization',
      'changelogComponent',
      //'isLoadingChangelog'
    ]),

    doiUrl: function(){
      return "https://doi.org/" + this.datasetDoi.doi
    },


    /**
     * Return corresponding contributor details
     * @returns {Object}
     */
    correspondingContributor: function() {
      const firstName = propOr('', 'firstName', this.datasetOwner)
      const lastName = propOr('', 'lastName', this.datasetOwner)
      const orcid = propOr({}, 'orcid', this.datasetOwner)
      const id = propOr('', 'orcid', orcid)
      return {
        firstName: firstName,
        lastName: lastName,
        orcid: id
      }
    },

    /**
     * Gets the first contributor from the list
     * @returns {String}
     */
    firstContributor: function() {
      return head(this.datasetContributors)
    },

    /**
     * Checks whether or not contributors list
     * should be condensed or not based on the number
     * of contributors in the dataset
     */
    datasetContributorsList: function() {
      return this.datasetContributors
    },

    /**
     * Compute if the user has at least manager permissions
     * @returns {Boolean}
     */
    hasManagerPermissions: function() {
      return this.datasetRole !== 'viewer'
        ? this.getPermission('manager')
        : false
    },

    /**
     * Compute URL for total package count
     * @returns {String}
     */
    getPackageTypeCountsUrl: function() {
      return this.userToken && this.isOrgSynced
        ? `${this.config.apiUrl}/datasets/${
            this.datasetId
          }/packageTypeCounts?api_key=${this.userToken}`
        : ''
    },

    /**
     * Compute if the dataset has a DOI
     * @returns {Boolean}
     */
    hasDatasetDoi: function() {
      return Object.keys(this.datasetDoi).length
    },

    /**
     * Compute if the dataset has a banner
     * @returns {Boolean}
     */
    hasBanner: function() {
      return this.datasetBanner !== ''
    },

    /**
     * Compute if the dataset has a subtitle
     * @returns {Boolean}
     */
    hasSubtitle: function() {
      const description = pathOr('', ['content', 'description'], this.dataset)
      return Boolean(description)
    },

    /**
     * Compute if the dataset has tags
     * @returns {Boolean}
     */
    hasTags: function() {
      const tags = pathOr([], ['content', 'tags'], this.dataset)
      return tags.length > 0
    },

    /**
     * Compute if the dataset has a description
     * @returns {Boolean}
     */
    hasDescription: function() {
      return this.datasetDescription !== ''
    },
    /**
     * Compute if the dataset has a changelog
     * @returns {Boolean}
     */
    hasChangelog: function() {
      return this.changelogText !== ''
    },

    /**
     * Compute if the dataset has a license
     * @returns {Boolean}
     */
    hasDatasetLicense: function() {
      return this.datasetLicense !== 'Add a license'
    },

    /**
     * Compute if the dataset has tags
     * @returns {Boolean}
     */
    hasContributors: function() {
      return this.datasetContributors.length > 0
    },

    /**
     * Compute label for version count
     * @returns {String}
     */
    publishedVersionLabel: function() {
      return propOr(1, 'publishedVersionCount', this.publishedData)
    },

    /**
     * Compute dataset name
     * @returns {String}
     */
    datasetName: function() {
      return pathOr('', ['content', 'name'], this.dataset)
    },

    /**
     * Compute dataset description including
     * adding line breaks to support multiline
     * @returns {String}
     */
    datasetSubtitle: function() {
      const description = pathOr('', ['content', 'description'], this.dataset)

      return replaceLineBreaks(description)
    },

    /**
     * Compute dataset storage
     * @returns {Object}
     */
    datasetStorage: function() {
      const storageProp = compose(
        propOr(0, 'storage'),
        defaultTo({})
      )(this.dataset)

      /* Need to return a fixed object due to
       * the default behavior of formatMetric
       */
      if (storageProp === 0) {
        return {
          number: 0,
          unit: 'KB'
        }
      }

      const storage = compose(
        split(' '),
        this.formatMetric
      )(storageProp)

      return storage.reduce((number, unit) => {
        return {
          number,
          unit
        }
      })
    },

    /**
     * Compute last updated date
     * @returns {String}
     */
    lastUpdatedDate: function() {
      const date = pathOr('', ['content', 'updatedAt'], this.dataset)
      return this.formatDate(date)
    },

    /**
     * Compute label for total records
     */

    totalRecordsCountLabel: function() {
      return this.totalRecordsCount === 1 ? 'Record' : 'Records'
    },

    /**
     * Compute the license for the dataset
     * @returns {String}
     */
    datasetLicense: function() {
      return pathOr('Add a license', ['content', 'license'], this.dataset)
    },

    /**
     * Compute URL for readme endpoint
     * @returns {String}
     */
    datasetReadmeUrl: function() {
      return this.userToken
        ? `${this.config.apiUrl}/datasets/${this.datasetId}/readme?api_key=${
            this.userToken
          }`
        : ''
    },

    /*
    *compute changelog endpoint
    */
    datasetChangelogUrl: function() {
      return this.userToken
        ? `${this.config.apiUrl}/datasets/${this.datasetId}/changelog?api_key=${
            this.userToken
          }`
        : ''
    },
    /**
     * Compute dataset intId
     * @returns {Number}
     */
    datasetIntId: function() {
      return pathOr(0, ['content', 'intId'], this.dataset)
    },
    
    /**
     * Compute dataset node id
     * @returns {String}
     */
     datasetNodeId: function() {
      const nodeId = pathOr('', ['content', 'id'], this.dataset)

      return nodeId
    },
  },

  watch: {
    '$route.query.editDescription': {
      handler: function(val) {
         if (val) {
        this.setEditDescription()
      }
      },
      immediate: true
    },

    getPackageTypeCountsUrl: {
      handler: function(val) {
        if (val) {
          this.getPackageTypeCounts()
        }
      },
      immediate: true
    },

    datasetIntId: {
      handler: function() {
        this.checkIfChecklistDismissed()
      },
      immediate: true
    }
  },

  mounted () {
    if (this.$route.query.editDescription) {
      this.setEditDescription()
    }
  },

  methods: {
    ...mapActions(['setDatasetDescription', 'setDatasetDescriptionEtag', 'setChangelogText']),


    staleUpdateDialogClose: function() {
      this.staleUpdateDialogVisible = false
    },
    /**
     * Check if the dataset checklist
     * has been dismissed
     */
    checkIfChecklistDismissed: function() {
      const dismissedDatasetChecklist = getDismissedDatasetChecklist()
      this.isChecklistDimissed =
        dismissedDatasetChecklist.indexOf(this.datasetIntId) >= 0
    },

    /**
     * Get package type counts
     */
    getPackageTypeCounts: function() {
      this.packageTypeCount = 0
      this.sendXhr(this.getPackageTypeCountsUrl)
        .then(response => {
          this.packageTypeCount = compose(
            sum,
            values,
            defaultTo({})
          )(response)
        })
        .catch(this.handleXhrError.bind(this))
    },

    /**
     * Set edit description and scroll to description
     */
    setEditDescription: function() {
      this.isEditingMarkdownDescription
 = true
      this.$nextTick(() => {
        this.$refs.descriptionDataCard.$el.scrollIntoView()
        this.$refs.markdownEditor.focus()
      })
    },

    /**
     * Compute checklist icon based on prop
     * @param {Boolean} prop
     * @returns {String}
     */
    computeChecklistIcon: function(prop = false) {
      return prop ? 'icon-done-check-circle' : 'icon-info'
    },

    /**
     * Dismiss the checklist by setting a cookie
     */
    dismissDatasetChecklist: function() {
      const dismissedDatasetChecklist = getDismissedDatasetChecklist()
      dismissedDatasetChecklist.push(this.datasetIntId)

      Cookie.set('dismissedDatasetChecklist', dismissedDatasetChecklist)

      this.isChecklistDimissed = true
    },

    /**
     * On reaadme save, emitted from the MarkdownEditor
     * Make a request to the API to save the readme
     * @params {String} markdown
     */
    onReadmeSave: function(markdown) {
      fetch(this.datasetReadmeUrl, {
        body: JSON.stringify({
          readme: markdown
        }),
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': this.datasetDescriptionEtag,
        }
      })
        .then(response => {
          if (response.ok) {
            this.setDatasetDescriptionEtag(response.headers.get('etag'))
            this.setDatasetDescription(markdown).finally(() => {
              this.isSavingMarkdownDescription = false
              this.isEditingMarkdownDescription
 = false
            })
          } else if (response.status === 412) {
            this.isSavingMarkdownDescription = false
            this.staleUpdateDialogVisible = true
          } else {
            throw response
          }
        })
        .catch(this.handleXhrError.bind(this))
    },

    /**
     * On changelog save, emitted from the MarkdownEditor
     * Make a request to the API to save the readme
     * @params {String} markdown
     */

    onChangelogSave: function(markdown) {
      fetch(this.datasetChangelogUrl, {
        body: JSON.stringify({
          changelog: markdown
        }),
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          if (response.ok) {
            this.setChangelogText(markdown).finally(() => {
              this.isSavingMarkdownChangelog = false
              this.isEditingMarkdownChangelog = false
            })
          } else if (response.status === 412) {
            this.isSavingMarkdownChangelog = false
            this.$refs.staleUpdateDialog.dialogVisible = true
          } else {
            throw response
          }
        })
        .catch(this.handleXhrError.bind(this))
    },


    getChangelog: function(datasetId) {
      //this.setIsLoadingDatasetDescription(true)
      const url = `${this.config.apiUrl}/datasets/${datasetId}/changelog?api_key=${this.userToken}`
      fetch(url)
        .then(response => {
          if (response.ok) {
            response.json().then(data => {
              const changelog = propOr('', 'changelog', data)
              this.setChangelogText(changelog)
            })
          } else {
            throw response
          }
        })
        .catch(this.handleXhrError.bind(this))
        .finally(() => {
          //this.setIsLoadingChangelog(false)
        })
    },

    /**
     * Go to the banner image section of the settings page
     */
    goToBanner: function() {
      if (this.hasManagerPermissions) {
        this.$router.push({
          name: 'dataset-settings',
          query: {
            focusInput: 'bannerImage'
          }
        })
      }
    },

    /**
    * Copy text to clipboard
    */
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        EventBus.$emit("toast", {
            detail: {
              msg: "Text copied to clipboard !",
            },
          });
      } catch (err) {
        EventBus.$emit("toast", {
            detail: {
              msg: "Failed to copy text",
            },
          });
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../assets/_variables';

.flex-heading {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.dataset-v {
  background: #fff;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}

.dataset-heading {
  display: flex;
  padding: 32px;
  background: $purple_tint;

  h1 {
    color: $gray_6;
    font-size: 24px;
    margin-bottom: 8px;
  }
}

.dataset-banner {
  cursor: pointer;
  height: 256px;
  margin-right: 24px;
  width: 256px;
}

.dataset-description {
  font-size: 16px;
  line-height: 24px;
  color: $gray_5;
}

.dataset-heading-info {
  flex: 1;
}

.dataset-heading-meta, .dataset-heading-cta {
  font-size: 14px;
  font-weight: normal;
  line-height: 24px;
  font-weight: normal;
  color: $gray_6;

  a {
    color: $gray_6;
    text-decoration: underline;
  }
}

.dataset-corresponding-contributor {
  display: flex;
  flex-direction: row;
  color: $gray_6;

  p {
    margin-right: 7px;
  }
}

.dataset-info-stats {
  background: $purple_1;
  color: white;
  border-bottom: 1px solid $gray_2;
  border-top: 1px solid $gray_2;
  display: flex;
  padding: 16px 64px;
  justify-content: space-between;

  .link {
    text-decoration: underline;
  }
  a {
    color: white;
  }
}
.dataset-info-stat {
  align-items: center;
  display: flex;
  .svg-icon {
    color: $white;
    margin-right: 8px;
  }
}

.dataset-owners {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  color: $gray_5;
  font-size: 14px;
  line-height: 24px;
  margin-bottom: 13px;
  .contributor-item-wrap {
    display: inline-flex;
    margin-right: 4px;
  }

  .contributors-button {
    height: 16px;
    width: 16px;
    border-radius: 2px;
    background-color: #dadada;
    margin: 0 6px;

    &:focus {
      background-color: #b6b7ba;
    }

    .button-text {
      position: relative;
      bottom: 5px;
    }
  }

  .edit-link {
    text-decoration: underline;
    margin-left: 5px;
  }
}
</style>
