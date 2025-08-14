<script setup>
import * as site from '../../../../site-config/site.json';
import {useGetToken} from "@/composables/useGetToken";
import {find, pathOr, propEq, propOr} from "ramda";
import {ref, computed, watch, onMounted} from "vue"
import {useRoute} from "vue-router";
import ModelRecordsResults from "@/components/datasets/explore/search/ModelRecordsResults.vue";
import SideDrawer from "@/components/shared/side-drawer/SideDrawer.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import {useStore} from "vuex";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";


const props = defineProps({
  drawerVisible: {
    type: Boolean,
    default: false
  },
  isCreatingRecord: {
    type: Boolean,
    default: false
  },
  linkedProperty: {
    type: Object,
    default: () => {}
  }
})

const store = useStore()
const emit = defineEmits(['close','update-linked-property'])
const route = useRoute()

const searchResults = ref([])

const recordTo = ref({})
const visible= ref(false)
const initialSelection = ref('')
const radioSelection = ref('')
const isCreating = ref(false)


const datasetLocked = computed(() => {
  return store.getters.datasetLocked
})

function updateSearchResults(sResults) {
  searchResults.value = sResults
}

/**
 * Compute if save changes button should be visible
 * @returns {Boolean}
 */
const disableButton = computed(() => {
  return !radioSelection.value || radioSelection.value === initialSelection.value
})
/**
 * Concept ID
 * @returns {String}
 */
// const conceptId = computed(() => {
//   return concept.value?.id || ''
// })

/**
 * Linked Property Url
 * @returns {String}
 */
const linkedPropertiesUrl = computed(() => {
  return `${site.conceptsUrl}/datasets/${
    route.params.datasetId ?? ''
  }/concepts/${
    conceptId.value
  }/instances/${
    route.params.instanceId ?? ''
  }/linked`


})

/**
 * Compute if user is editing a linked property
 * @returns {Boolean}
 */
const isEditing = computed(() => {
  return !!initialSelection.value
})



/**
 * Handles close-side-drawer event
 */
function closeSideDrawer() {
  recordTo.value = {}
  radioSelection.value = ''
  initialSelection.value = ''

  emit('close')
}


/**
 * Handle update-record-to event from ConceptSearchResults
 * @param {Object} record
 */
function onUpdateRecordTo(record) {
  recordTo.value = record
}

/**
 * Save Changes
 */
function saveChanges() {
  if (isEditing.value && !props.isCreatingRecord) {
    deleteRelationship()
      .then(createRelationship)
      .catch(useHandleXhrError)
  } else {
    createRelationship()
  }
}

/**
 * Create linked property relationship
 */
function createRelationship() {
  isCreating.value = true

  const { name, displayName, id } = props.linkedProperty.schemaLinkedProperty

  const body = {
    name,
    displayName,
    schemaLinkedPropertyId: id,
    to: radioSelection.value
  }

  if (props.isCreatingRecord) {
    emit('update-linked-property', body)
    closeSideDrawer()
    isCreating.value = false
  } else {
    sendCreateRelationshipRequest(body)
  }
}

/**
 * Create linked property request
 * Send request to endpoint to create the linked property
 * @params {Object} body
 */
function sendCreateRelationshipRequest(body) {
  useGetToken()
    .then(token => {
      useSendXhr(linkedPropertiesUrl.value, {
        method: 'POST',
        header: {
          'Authorization': `bearer ${token}`
        },
        body
      })
        .then(response => {
          emit('update-linked-property', response)
          closeSideDrawer()
          isCreating.value = false

          // EventBus.$emit('toast', {
          //   detail: {
          //     type: 'success',
          //     msg: `Linked Property Saved`
          //   }
          // })
          //
          // // track adding a linked property
          // EventBus.$emit('track-event', {
          //   name: 'Linked Property Added'
          // })
        })
        .catch(useHandleXhrError)
    })

}

/**
 * Makes XHR call to remove linked property
 */
async function deleteRelationship() {

  return useGetToken()
    .then(token => {
      if (linkedPropertiesUrl.value) {
        const id = propOr('', 'linkedPropertyId', props.linkedProperty)
        const url = `${linkedPropertiesUrl.value}/${id}`

        return useSendXhr(url, {
          method: 'DELETE',
          header: {
            'Authorization': `bearer ${token}`
          }
        })
      }
    }).catch(useHandleXhrError)


}

function onRadioSelection(selection) {
  radioSelection.value = selection
  recordTo.value = searchResults.value.find(r => r.id === radioSelection.value)
}


const concept = ref({})

onMounted(() => {


})


watch(props.linkedProperty, async (val, oldVal) => {
    store.dispatch('metadataModule/fetchModels')
      .then(() => {
        const modelId = pathOr('', ['to', 'modelId'], val)
        const m = store.getters["metadataModule/getModelById"](modelId)
        concept.value = store.getters["metadataModule/getModelById"](modelId)
      })
  }, {immediate: true, deep: true}
)

watch(searchResults.value, async(val, oldVal) => {
  if (val.length > 0) {
    const id = radioSelection.value
    const record = find(propEq('id', id), val)

    if (record) {
      recordTo.value = record
    }
  }
})


</script>

<template>
  <side-drawer
    class="add-model-property-drawer"
    heading="Select a Record"
    :visible="drawerVisible"
    @close-side-drawer="closeSideDrawer"
  >
    <template #copy>
      <p>Choose from the records below.</p>
    </template>

    <template #body>
      <div class="search-results-wrap">
<!--        <model-records-results-->
<!--          :concept="concept"-->
<!--          :has-radio-selection="true"-->
<!--          :radio-selection="radioSelection"-->
<!--          @radio-selection="onRadioSelection"-->
<!--          @search-results-changed="updateSearchResults"-->
<!--        />-->
      </div>
    </template>

    <template #buttons>
      <div>
        <bf-button
          class="secondary"
          @click="closeSideDrawer"
        >
          Cancel
        </bf-button>
        <bf-button
          :disabled="disableButton || datasetLocked"
          @click="saveChanges"
        >
          Save
        </bf-button>
      </div>
    </template>

  </side-drawer>
</template>


<style lang="scss" scoped>
@import '../../../../assets/variables';

.search-results-wrap {
  flex: 1;
  overflow: hidden;
}
</style>
