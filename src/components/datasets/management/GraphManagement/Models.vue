<template>
  <bf-stage
    v-loading="loadingModels && !isLoadingConcepts"
  >
    <div
      class="models"
      element-loading-background="transparent"
    >
      <div
        v-if="showCards"
        class="graph-management-cards"
      >
        <button
          :disabled="datasetLocked"
          @click="createConcept"
        >
          <bf-card
            :class="{ disabled: datasetLocked }"
            title="New Model"
            card-copy="Create a new model for metadata records."
          >
            <template #icon>
              <icon-add-template
                class="card-icon"
                :height="48"
                :width="48"
              />
            </template>
          </bf-card>
        </button>
        <button
          :disabled="datasetLocked"
          @click="createConcept"
        >
          <bf-card
            :class="{ disabled: datasetLocked }"
            title="Template Gallery"
            card-copy="Create a model based on a template"
          >
            <template #icon>
              <IconOverview
                class="card-icon"
                :height="48"
                :width="96"
                                />

            </template>
          </bf-card>
        </button>
      </div>

      <div v-if="hasModels">
        <h2>Dataset Models</h2>
        <concept-list-item
          v-for="concept in combinedConcepts"
          :key="concept.id"
          :concept="concept"
          @lock-concept="openLockDialog"
          @unlock-concept="onUnlockConcept"
        />
      </div>

      <dataset-owner-message
        v-if="hasNoModels"
        title="You have no metadata models defined yet"
        :display-owner-message="true"
        :hide-got-it="true"
        class="long-copy"
      >
        <img
          slot="img"
          src="/src/assets/images/illustrations/illo-missing-models.svg"
          alt=""
        >
        <template #copy>
          <p>
            Models are the basis of your metadata schema. Before adding metadata records, you'll need to <br> create some models
          </p>
        </template>

        <template #button>
          <bf-button
            class="new-model-button"
            :disabled="datasetLocked"
            @click="createConcept"
          >
            New Model
          </bf-button>
        </template>

        <p
          v-if="modelTemplates.length > 0 && datasetLocked === false"
          slot="link"
        >
          <router-link :to="{ name: 'model-templates' }">
            Add a model from a template
          </router-link>
        </p>
      </dataset-owner-message>

      <create-concept-dialog
        :dialog-visible="createConceptDialogVisible"
        @close="closeCreateConceptDialog"
      />
    </div>

  </bf-stage>
</template>

<script>
  import { mapGetters, mapActions, mapState } from 'vuex'
  import { pathOr, propOr, findIndex, propEq, find, head, clone, defaultTo } from 'ramda'

  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import BfCard from '../../../shared/bf-card/BfCard.vue'
  import ConceptDialog from '../../explore/ConceptDialog/ConceptDialog.vue'
  import ConceptListItem from './ConceptListItem/ConceptListItem.vue'
  import CreateConceptDialog from '../CreateConceptDialog/CreateConceptDialog.vue'
  import DatasetOwnerMessage from '../../../shared/DatasetOwnerMessage/DatasetOwnerMessage.vue'

  import EventBus from '../../../../utils/event-bus'
  import Request from '../../../../mixins/request'
  import IconAddTemplate from "../../../icons/IconAddTemplate.vue";
  import IconGallery from "../../../icons/IconGallery.vue";
  import IconArrowRight from "../../../icons/IconArrowRight.vue";
  import IconLockFilled from "../../../icons/IconLockFilled.vue";
  import IconTrash from "../../../icons/IconTrash.vue";
  import Cookies from "js-cookie";
  import DeleteConceptDialog from "@/components/datasets/management/DeleteConceptDialog/DeleteConceptDialog.vue";
  import {useGetToken} from "@/composables/useGetToken";
  import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
  import IconClinicalTrial from "@/components/icons/IconClinicalTrial.vue";
  import IconDocument from "@/components/icons/IconDocument.vue";
  import IconGraph from "@/components/icons/IconGraph.vue";
  import IconOverview from "@/components/icons/IconOverview.vue";

  export default {
    name: 'Models',

    components: {
      IconOverview,
      IconGraph,
      IconDocument,
      IconClinicalTrial,
      DeleteConceptDialog,
      IconTrash,
      IconLockFilled,
      IconArrowRight,
      IconGallery,
      IconAddTemplate,
      BfButton,
      BfCard,
      ConceptDialog,
      ConceptListItem,
      CreateConceptDialog,
      DatasetOwnerMessage
    },

    mixins: [
      Request
    ],

    data() {
      return {
        activeModel: {
          name: '',
          displayName: ''
        },
        archiveDialogVisible: false,
        createConceptDialogVisible: false,
        lockDialogVisible: false,
        combinedConcepts: null,
        loadingModels: true
      }
    },
    mounted() {
      this.fetchModels()

    },
    beforeDestroy() {

    },

    computed: {
      ...mapGetters([
        'config',
        'hasFeature',
        'activeOrganization',
        'datasetLocked'
      ]),
      ...mapState([
        'modelTemplates',
        'dataset',
        'isLoadingConcepts'
      ]),
      ...mapState('metadataModule',[
        'models'
      ]),

      /**
       * Computes if cards should be displayed
       * @returns {Boolean}
       */
      showCards: function() {
        return !this.loadingModels && this.models.length > 0
      },

      /**
       * Computes if models exist in the current dataset
       * @returns {Boolean}
       */
      hasModels: function() {
        return !this.loadingModels && this.combinedConcepts && this.combinedConcepts.length > 0
      },

      /**
       * Computes if no models exist in the current dataset
       * @returns {Boolean}
       */
      hasNoModels: function() {
        return !this.isLoadingConcepts && (!this.models || this.models.length === 0)
      },

      /**
       * Computes whether or not model templates feature is enabled
       * @returns {Boolean}
       */
      hasModelTemplatesFeature: function() {
        return this.hasFeature('model_templates_feature')
      },

      /**
       * Compute model URL
       * @returns {String}
       */
      modelUrl: function() {
        const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
        const modelId = propOr('', 'id', this.activeModel)
        return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}`
      },

      galleryLinkComponent: function() {
        return this.datasetLocked ? 'div' : 'router-link'
      }
    },

    watch: {
      '$route.query.openNewModelDialog': {
        handler: function(openNewModelDialog) {
          if (openNewModelDialog) {
            this.createConcept()
          }
        },
        immediate: true
      },
      models: {
        handler: function(val) {
          if (val && !this.combinedConcepts || (this.combinedConcepts && this.combinedConcepts.length !== this.models.length)) {
            this.getLinkedProps(val)
          }
        },
        immediate: true,
        deep: true
      }
    },

    methods: {
      ...mapActions([
        'updateConcepts',
      ]),
      ...mapActions('metadataModule', [
        'fetchModels',
      ]),


      closeCreateConceptDialog: function() {
        this.createConceptDialogVisible = false
      },

      /**
       * Builds list of linked properties calls per model
       * @param {Object} models
       * @returns {Promise}
       */
      buildLinkedPromises: function(models) {
        const datasetId = this.$route.params.datasetId
        const promises = models.map(model => {
          const modelId = model.id
          const url = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}/linked`
          return useGetToken()
            .then(token => {
              return useSendXhr(url, {
                header: {
                  'Authorization': `bearer ${token}`
                }
              })
            }).catch(err => useHandleXhrError(err))

        })
        return promises
      },

      /**
       * Combines linked property count with propertyCount
       * @param {Object} models
       */
      getLinkedProps: function(models) {
        if (models.length === 0) {
          this.loadingModels = false
          this.combinedConcepts = []
          return
        }
        const promises = this.buildLinkedPromises(models)
        Promise.all(promises)
          .then(linkedProps => {
            this.combinedConcepts = clone(this.models)
            linkedProps
              .filter(linked => linked.length > 0)
              .forEach(linked => {
                // increment count
                const concept = pathOr('', ['link', 'from'], head(linked))
                const updatedConcept = find(propEq('id', concept), this.combinedConcepts)
                updatedConcept.propertyCount = updatedConcept.propertyCount + linked.length
                // update combinedConcepts
                const idx = findIndex(propEq('id', concept), this.combinedConcepts)
                this.combinedConcepts.splice(idx, 1, updatedConcept)
              })
            this.loadingModels = false
          })
          .catch(err => {
            this.loadingModels = false
            this.handleXhrError(err)
          })
      },

      /**
       * Create a new concept
       */
      createConcept: function() {
        this.createConceptDialogVisible = true
      },

      /**
       * Open Lock Dialog
       * @param {object} model
       */
      openLockDialog: function(model) {
        this.activeModel = model
        this.lockDialogVisible = true
      },

      /**
       * Lock concept
       */
      setLockModel: function(locked) {
        const body = Object.assign({}, this.activeModel, { locked })

        useGetToken()
          .then(token => {
            this.sendXhr(this.modelUrl, {
              method: 'PUT',
              header: {
                'Authorization': `bearer ${token}`
              },
              body
            })
              .then(response => {
                this.lockDialogVisible = false
                this.updateModel(response)
              })
              .catch(this.handleXhrError.bind(this))
          })

      },

      onUnlockConcept: function(model) {
        this.activeModel = model
        this.setLockModel(false)
      },

      /**
       * Update model in state
       * @param {Object} response
       */
      updateModel: function(response) {
        const index = findIndex(propEq('name', response.name), this.models)
        const updatedConcepts = this.models.slice()
        updatedConcepts.splice(index, 1, response)
        this.updateConcepts(updatedConcepts)

        this.activeModel = {}
      }
    }
  }
</script>

<style lang="scss" scoped>
  @use '../../../../styles/theme';

  .card-icon {
    color: theme.$purple_2;
  }

  .models {
    min-height: 500px;

    h2 {
      font-size: 20px;
      line-height: 24px;
    }

    .owner-message p {
      max-width: 680px;
    }

    .graph-management-cards {
      display: flex;
      margin-bottom: 48px;

    }

    .gallery-link {
      &:hover {
        text-decoration: none;
      }
      &.disabled {
        cursor: default;
        opacity: .6;
      }
    }

    .view-templates-link {
      align-items: center;
      display: flex;
      justify-content: center;

      .view-templates-link-text {
        width: 64px;
      }
    }

    .bf-card {
      height: 183px;
      min-width: 175px;
      max-width: 175px;
      padding: 32px 16px;
    }

    .owner-message p {
      max-width: 680px;
    }

    .long-copy {
      border: none;
      img {
        height: 74px;
        width: 109px;
      }

      p {
        color: #71747C;
        font-size: 14px;
        line-height: 16px;
        text-align: center;
        padding-bottom: 16px;
      }

      .new-model-button {
        height: 40px;
        width: 114px;
        margin-bottom: 16px;
      }
    }
  }
</style>
