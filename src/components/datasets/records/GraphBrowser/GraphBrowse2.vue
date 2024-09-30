<script setup>
import {computed, watch, nextTick, ref,onMounted} from 'vue'
import {MarkerType, useVueFlow, VueFlow} from '@vue-flow/core'
import {Background} from '@vue-flow/background'
import {Controls} from '@vue-flow/controls'
import {MiniMap} from '@vue-flow/minimap'
import * as site from '../../../../site-config/site.json';
import {useLayout} from './useLayout'
import {useHandleXhrError, useSendXhr} from '@/mixins/request/request_composable'
import {useStore} from 'vuex';
import {pathOr,isEmpty} from "ramda";
import {useRoute} from "vue-router";
import ModelNode from './ModelNode.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import CreateConceptDialog from "@/components/datasets/management/CreateConceptDialog/CreateConceptDialog.vue";
import CreateLinkedPropDialog from "@/components/datasets/records/GraphBrowser/CreateLinkedPropDialog.vue";
import SidePanel from "@/components/datasets/records/GraphBrowser/SidePanel.vue";
import AddEditModelProperty from "@/components/datasets/records/GraphBrowser/AddEditModelProperty.vue";
import DeletePropertyDialog from "@/components/datasets/records/GraphBrowser/DeletePropertyDialog.vue";
import DeleteLinkedPropDialog from "@/components/datasets/records/GraphBrowser/DeleteLinkedPropDialog.vue";
import DeleteRelationshipDialog from "@/components/datasets/records/GraphBrowser/DeleteRelationshipDialog.vue";
import DeleteModelDialog from "@/components/datasets/records/GraphBrowser/DeleteModelDialog.vue";

const props = defineProps(['orgId', 'datasetId','list-type'])
const route = useRoute()
const store = useStore()
const { layout } = useLayout()
const { onInit, onConnect, addEdges, fitView, findNode, getSelectedNodes } = useVueFlow()

/*
Bootup and configuration of component
 */
const stringSubtypes = ref({})
onMounted(() => {
  store.dispatch('metadataModule/fetchModels')

  if (isEmpty(stringSubtypes.value)) {
    let url = `${site.apiUrl}/models/datasets/${datasetId.value}/properties/strings?api_key=${store.state.userToken}`
    fetchStringSubtypes(url)
  }
})
const datasetId = computed( () => {
  return pathOr('', ['params', 'datasetId'])(route)
})

watch(route, async (newQuestion, oldQuestion) => {
  if (site.apiUrl && datasetId) {
    let url = `${site.apiUrl}/models/datasets/${datasetId.value}/properties/strings?api_key=${store.state.userToken}`
    fetchStringSubtypes(url)

  }})

function fetchStringSubtypes(url) {
  useSendXhr(url,{
    header: {
      'Authorization': `bearer ${store.state.userToken}`
    },
    method: 'GET',
  })
    .then(subTypes => {
      stringSubtypes.value = Object.entries(subTypes).reduce(
        (options, [val, config]) => ([...options, { value: val, label: config.label, regex: config.regex }]),
        []
      )
    })
    .catch(response => {
      useHandleXhrError(response)
    })
}


/*
VueFlow Config and Create Relationships
 */
const minimapLocation = computed( () => {
  if (sidePanelVisible.value) {
    return "bottom-left"
  }

  return "bottom-right"
})
onInit((vueFlowInstance) => {
  getGraphData(vueFlowInstance)
})
let createRelationshipInput = {source:null, target: null}
onConnect((connection) => {
  // Find Node Name
  const sourceNode = findNode(connection.source)
  const targetNode = findNode(connection.target)

  createRelationshipInput = {source: sourceNode, target: targetNode, sourceHandle: connection.sourceHandle }
  createLinkedPropDialogVisible.value = true
})
function focusNode(event) {
  fitView({
    nodes: [event.id],
    duration: 1000, // use this if you want a smooth transition to the node
    padding: 2 // use this for some padding around the node
  })
}

/*
Side Panel Logic
 */
const sidePanelVisible = ref(true)
function onTogglePanelVisibility() {
  sidePanelVisible.value = !sidePanelVisible.value
}


/*
Fetch schema Logic
 */
const edges = ref([])
const nodes = ref([])
const allEdges = ref([])
const graphUrl = computed(() => {
  const apiUrl = site.conceptsUrl
  // const datasetId = pathOr('', ['params', 'datasetId'])(route)

  if (apiUrl && datasetId) {
    return `${apiUrl}/datasets/${datasetId.value}/concepts/schema/graph`
  }
  return null
})
function transformApiResponse(data) {

  const nodes = []
  const edges = []
  allEdges.value = []
  let edgeMap = new Map()

  data.forEach(obj => {
    if (obj.type && (obj.type === 'schemaRelationship' || obj.type === 'schemaLinkedProperty')) {

      allEdges.value.push(obj)

      const hasFromNode = data.findIndex(d => d.id === obj.from) >= 0
      const hasToNode = data.findIndex(d => d.id === obj.to) >= 0

      if (hasFromNode && hasToNode) {

        const strokeColor = obj.type === "schemaRelationship" ?  "#F9A23A" : "#011F5B"
        const type = obj.type === "schemaRelationship" ? "default" : "smoothstep"
        const sourceHandle = obj.type === "schemaLinkedProperty" ? "source-a" : "source-b"
        const targetHandle = obj.type === "schemaLinkedProperty" ? "target-a" : "target-b"

        const curObject = {
          id: obj.id,
          type: type,
          source: obj.from,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          target: obj.to,
          label: obj.displayName,
          markerEnd: MarkerType.ArrowClosed,
          style: { stroke: strokeColor, color: strokeColor},
        }

        // Check if the edge already exists. If so, just update label,
        // otherwise, add edge.
        let curNodeEdges = edgeMap.get(obj.from)
        if (curNodeEdges) {
          // Check if current exist
          let found = false;
          for (let i in curNodeEdges) {

            if (curNodeEdges[i].target === obj.to && type === curNodeEdges[i].type) {

              edgeMap.set(obj.from, [...curNodeEdges, obj])
              curNodeEdges[i].label = curNodeEdges[i].label + " / " + obj.displayName

              found = true
              break
            }
          }

          if (!found) {
            edgeMap.set(obj.from, [curObject])
            edges.push(curObject)
          }

        } else {
          edgeMap.set(obj.from, [curObject])
          edges.push(curObject)
        }
      }
      else {
        console.log("Error: Incorrectly formatted edge")
      }
    } else {
      const curObject = {
        id: obj.id,
        type: 'custom',
        deletable: false,
        data: {
          label: obj.displayName,
          id: obj.id

        },
        position: {x:0, y:0},

      }

      nodes.push(curObject)
    }
  })

  return { nodes, edges }
}
function getGraphData(vueFlowInstance) {

  useSendXhr(graphUrl.value, {
    header: {
      'Authorization': `bearer ${store.state.userToken}`
    }
  })
    .then(response => {

      const graphData = transformApiResponse(response)
      nodes.value = graphData.nodes
      edges.value = graphData.edges
      nodes.value = layout(nodes.value, edges.value, 'BT')

      nextTick(() => {
        vueFlowInstance.fitView()
      })


    })
    .catch(useHandleXhrError())
}

/*
Adding Model Logic
 */
const createConceptDialogVisible = ref(false)
function createModel() {
  createConceptDialogVisible.value = true
}
function closeCreateConceptDialog() {

  let vueFlowInstance = useVueFlow()
  getGraphData(vueFlowInstance)
  store.dispatch('metadataModule/fetchModels')
  createConceptDialogVisible.value = false
}
const propertiesForSelectedModel= computed(() => {
  if (selectedModelId.value){
    console.log(selectedModelId.value)
    let m = store.getters['metadataModule/getModelById'](selectedModelId.value)
    return m.props

  }
  return []

})


/*
Adding Linked Properties Logic
 */
const createLinkedPropDialogVisible = ref(false)
async function closeCreateLinkedPropDialog(data) {

  createLinkedPropDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    let vueFlowInstance = useVueFlow()
    getGraphData(vueFlowInstance)
  });


}

/*
Add Property Dialog Logic
 */
const addEditPropertyDialogVisible = ref(false)
function onOpenPropertyDialog() {
  addEditPropertyDialogVisible.value = true
}
function closeEditPropertyDialog() {
  addEditPropertyDialogVisible.value = false
}
async function onAddProperty() {
  addEditPropertyDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    store.dispatch("metadataModule/fetchModelProps", selectedModelId.value);
  });
}
const selectedModelId = computed( () => {

  const s = getSelectedNodes
  if (s.value.length > 0) {
    return s.value[0].id
  }

  return ""
})
const selectedModel = computed( () => {

  const s = getSelectedNodes
  if (s.value.length > 0) {
    return store.getters["metadataModule/getModelById"](s.value[0].id)
  }

  return {}
})

/*
Edit Property Logic
 */
function onOpenEditPropertyDialog(event) {
  selectedProperty.value = event.property
  addEditPropertyDialogVisible.value = true
}
async function onEditProperty() {
  addEditPropertyDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    store.dispatch("metadataModule/fetchModelProps", selectedModelId.value);
  });
}

/*
Delete Property Dialog Logic
 */
const deletePropertyDialogVisible = ref(false)
const selectedProperty = ref({})
function onOpenDeletePropertyDialog(event) {
  selectedProperty.value = event.property
  deletePropertyDialogVisible.value = true

}
function onCloseDeletePropertyDialog() {
  deletePropertyDialogVisible.value = false
}
async function onDeleteProperty() {
  deletePropertyDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    store.dispatch("metadataModule/fetchModelProps", selectedModelId.value);
  });
}

/*
Delete Linked Property Dialog Logic
 */
const deleteLinkedPropDialogVisible = ref(false)
const selectedLinkedProp = ref({})
function onOpenDeleteLinkedPropDialog(event) {
  selectedLinkedProp.value = event
  deleteLinkedPropDialogVisible.value = true
}
function onCloseDeleteLinkedPropDialog() {
  deleteLinkedPropDialogVisible.value = false
}
async function onDeleteLinkedProperty() {
  deleteLinkedPropDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    let vueFlowInstance = useVueFlow()
    getGraphData(vueFlowInstance)
  });
}

/*
Delete Relationship Dialog Logic
 */
const deleteRelationshipDialogVisible = ref(false)
const selectedRelationship = ref({})
function onOpenDeleteRelationshipDialog(event) {
  selectedRelationship.value = event
  deleteRelationshipDialogVisible.value = true
}
function onCloseDeleteRelationshipDialog() {
  deleteRelationshipDialogVisible.value = false
}
async function onDeleteRelationship() {
  deleteRelationshipDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    let vueFlowInstance = useVueFlow()
    getGraphData(vueFlowInstance)
  });
}

/*
Delete Model Dialog Logic
 */
const deleteModelDialogVisible = ref(false)
function onOpenDeleteModelDialog() {
  deleteModelDialogVisible.value = true

}
function onCloseDeleteModelDialog() {
  deleteModelDialogVisible.value = false
}
async function onDeleteModel() {
  deleteModelDialogVisible.value = false

  // Need to wait a bit to make sure the property is actually created on the backend.
  await new Promise(r => setTimeout(r, 500)).then(() => {
    // store.dispatch('metadataModule/fetchModels')
    let vueFlowInstance = useVueFlow()
    getGraphData(vueFlowInstance)
  });
}



</script>

<template>

  <div class="graph-browser">
    <div class="vue-flow-wrapper">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        class="basic-flow"
        :default-viewport="{ zoom: 1 }"
        :min-zoom="0.2"
        :max-zoom="4"

      >
        <template #node-custom="props">
          <ModelNode :data="props.data" />
        </template>

        <Background pattern-color="#aaa" :gap="16" />

        <MiniMap :position="minimapLocation" :pannable="true"/>

        <Controls position="top-left" />
      </VueFlow>
    </div>

    <bf-button
      @click="createModel"
      :class="{ 'action-button': true, 'flex': true }"
    >
      <template #prefix>
        <IconAddTemplate class="mr-8" :height="20" :width="20" />
      </template>
      Create Model
    </bf-button>

    <SidePanel
      :class="{ 'visible': sidePanelVisible }"
      :panel-visible="sidePanelVisible"
      @toggle-panel-visibility="onTogglePanelVisibility"
      @open-property-dialog="onOpenPropertyDialog"
      @open-delete-prop-dialog="onOpenDeletePropertyDialog"
      @open-delete-linked-prop-dialog="onOpenDeleteLinkedPropDialog"
      @open-delete-relationship-dialog="onOpenDeleteRelationshipDialog"
      @open-delete-model-dialog="onOpenDeleteModelDialog"
      @open-edit-property-dialog="onOpenEditPropertyDialog"
      @focus-node="focusNode"
      :edges="allEdges"
      :model-id="selectedModelId"
    />

  </div>

  <create-concept-dialog
    :dialog-visible="createConceptDialogVisible"
    @close="closeCreateConceptDialog"
  />

  <create-linked-prop-dialog
    :dialog-visible="createLinkedPropDialogVisible"
    :input="createRelationshipInput"
    @close="closeCreateLinkedPropDialog"
  />

  <add-edit-model-property
    ref="addPropertyDialog"
    :dialog-visible="addEditPropertyDialogVisible"
    :model-id="selectedModelId"
    :string-subtypes="stringSubtypes"
    :property-edit="selectedProperty"
    :properties="propertiesForSelectedModel"
    @add-property="onAddProperty"
    @edit-property="onEditProperty"
    @close="closeEditPropertyDialog"
  />

  <delete-property-dialog
    :model-id="selectedModelId"
    :property="selectedProperty"
    :dialog-visible="deletePropertyDialogVisible"
    @delete-property="onDeleteProperty"
    @close="onCloseDeletePropertyDialog"
  />

  <delete-linked-prop-dialog
    :model-id="selectedModelId"
    :link="selectedLinkedProp"
    :dialog-visible="deleteLinkedPropDialogVisible"
    @delete-property="onDeleteLinkedProperty"
    @close="onCloseDeleteLinkedPropDialog"
  />

  <delete-relationship-dialog
    :model-id="selectedModelId"
    :link="selectedRelationship"
    :dialog-visible="deleteRelationshipDialogVisible"
    @delete-relationship="onDeleteRelationship"
    @close="onCloseDeleteRelationshipDialog"
  />

  <delete-model-dialog
    :model="selectedModel"
    :dialog-visible="deleteModelDialogVisible"
    @delete-model="onDeleteModel"
    @close="onCloseDeleteModelDialog"
  />


</template>

<style lang="sass" >


/* these are necessary styles for vue flow */
@import '@vue-flow/core/dist/style.css'

/* this contains the default theme, these are optional styles */
@import '../../../../assets/_vueflow_core.scss'
@import '../../../../assets/_vueflow.css'

@import '@vue-flow/minimap/dist/style.css'

</style>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.modified-stage {
  margin: 0;

}

.graph-browser {
  height: calc(100vh - 114px);
  overflow: hidden;
  position: relative;
}

.vue-flow-wrapper {
  width: 100%;
  height:100%;
  position: relative;

}

.action-button {
  position: absolute;
  right: 16px;
  top: 16px;

  &.second {
    right: 170px;
  }
}



.btn-toggle-model-details {
  align-items: center;
  background: $gray_1;
  border-left: 1px solid $gray_2;
  border-right: 1px solid $gray_2;
  border-top: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 88px;
  width: 35px;

}


.btn-toggle-models-list {
  align-items: center;
  background: $gray_1;
  border: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 33px;
  width: 35px;

  &.selected {
    &:after {

      background: $gray_1;
      content: '';
      height: 100%;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: -5px;
      width: 5px;
    }
  }

}


</style>
