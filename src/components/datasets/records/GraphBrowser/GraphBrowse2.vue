<script setup>
import {computed, nextTick, ref} from 'vue'
import {MarkerType, useVueFlow, VueFlow} from '@vue-flow/core'
import {Background} from '@vue-flow/background'
import {Controls} from '@vue-flow/controls'
import {MiniMap} from '@vue-flow/minimap'
import * as site from '../../../../site-config/site.json';
import {useLayout} from './useLayout'

import {useHandleXhrError, useSendXhr} from '@/mixins/request/request_composable'
import {useStore} from 'vuex';
import {pathOr} from "ramda";
import {useRoute} from "vue-router";
import ModelNode from './ModelNode.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import CreateConceptDialog from "@/components/datasets/management/CreateConceptDialog/CreateConceptDialog.vue";
import CreateLinkedPropDialog from "@/components/datasets/records/GraphBrowser/CreateLinkedPropDialog.vue";

import SidePanel from "@/components/datasets/records/GraphBrowser/SidePanel.vue";


const props = defineProps(['orgId', 'datasetId','list-type'])

const route = useRoute()
const store = useStore()

const { layout } = useLayout()

/**
 * `useVueFlow` provides:
 * 1. a set of methods to interact with the VueFlow instance (like `fitView`, `setViewport`, `addEdges`, etc)
 * 2. a set of event-hooks to listen to VueFlow events (like `onInit`, `onNodeDragStop`, `onConnect`, etc)
 * 3. the internal state of the VueFlow instance (like `nodes`, `edges`, `viewport`, etc)
 */
const { onInit, onNodeDragStop, onConnect, addEdges, fitView, findNode, getSelectedNodes } = useVueFlow()

const edges = ref([])
const nodes = ref([])

let createConceptDialogVisible = ref(false)
let createLinkedPropDialogVisible = ref(false)



/**
 * Create a new concept
 */
function createModel() {
  createConceptDialogVisible.value = true
}

function closeCreateConceptDialog() {

  let vueFlowInstance = useVueFlow()
  getGraphData(vueFlowInstance)
  store.dispatch('metadataModule/fetchModels')
  createConceptDialogVisible.value = false
}

/*
 * @param {addedRelationship: boolean, connection: Object} data
 */
function closeCreateLinkedPropDialog(data) {
  if (data.addedRelationship) {
    const strokeColor = data.type === "schemaRelationship" ?  "#F9A23A" : "#011F5B"


    let connection = {
      source: data.connection.source.data.id,
      target: data.connection.target.data.id,
      type: 'smoothstep',
      label: data.displayName,
      markerEnd: MarkerType.ArrowClosed,
      style: { stroke: strokeColor, color: strokeColor },
    }
    addEdges(connection)
  }

  createLinkedPropDialogVisible.value = false


}

/**
 * This is a Vue Flow event-hook which can be listened to from anywhere you call the composable, instead of only on the main component
 * Any event that is available as `@event-name` on the VueFlow component is also available as `onEventName` on the composable and vice versa
 *
 * onInit is called when the VueFlow viewport is initialized
 */
onInit((vueFlowInstance) => {
  getGraphData(vueFlowInstance)
})

function focusNode(event) {
  fitView({
    nodes: [event.id],
    duration: 1000, // use this if you want a smooth transition to the node
    padding: 2 // use this for some padding around the node
  })
}

/**
 * Toggle models list visibility and scroll list to the top
 */
let modelsListVisible = ref(true)

const minimapLocation = computed( () => {
  if (modelsListVisible.value) {
    return "bottom-left"
  }

  return "bottom-right"
})

const modelsListArrowDir = computed( () => {
  if (modelsListVisible.value) {
    return "right"
  }
  return "left"
})

function toggleModelsList() {
  modelsListVisible.value = !modelsListVisible.value
}

/*
Get GraphData fetched the schema from the server and
formats the schema into nodes and edges for display.
 */
const graphUrl = computed(() => {
  const apiUrl = site.conceptsUrl
  // const datasetId = pathOr('', ['params', 'datasetId'])(route)

  if (apiUrl && datasetId) {
    return `${apiUrl}/datasets/${datasetId.value}/concepts/schema/graph`
  }
  return null
})

const datasetId = computed( () => {
  return pathOr('', ['params', 'datasetId'])(route)
})

const selectedModelId = computed( () => {

  const s = getSelectedNodes
  if (s.value.length > 0) {
    return s.value[0].id
  }

  return null
})

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

/**
 * Transform API GET Response
 * @param {Array} data
 * @returns {Object}
 */
function transformApiResponse(data) {

  const nodes = []
  const edges = []
  let edgeMap = new Map()

  data.forEach(obj => {
    if (obj.type && (obj.type === 'schemaRelationship' || obj.type === 'schemaLinkedProperty')) {
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

function onTogglePanelVisibility() {
  modelsListVisible.value = !modelsListVisible.value
}


/**
 * onNodeDragStop is called when a node is done being dragged
 *
 * Node drag events provide you with:
 * 1. the event object
 * 2. the nodes array (if multiple nodes are dragged)
 * 3. the node that initiated the drag
 * 4. any intersections with other nodes
 */
onNodeDragStop(({ event, nodes, node }) => {

  console.log('Node Drag Stop', { event, nodes, node })
})


let createRelationshipInput = ref({source:null, target: null})

/**
 * onConnect is called when a new connection is created.
 *
 * You can add additional properties to your new edge (like a type or label) or block the creation altogether by not calling `addEdges`
 */
onConnect((connection) => {
  // Find Node Name
  const sourceNode = findNode(connection.source)
  const targetNode = findNode(connection.target)

  createRelationshipInput = {source: sourceNode, target: targetNode, sourceHandle: connection.sourceHandle }
  createLinkedPropDialogVisible.value = true
})

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
      :class="{ 'visible': modelsListVisible }"
      :panel-visible="modelsListVisible"
      @toggle-panel-visibility="onTogglePanelVisibility"
      @focus-node="focusNode"
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
}

.models-list-wrap {
  border-top: 1px solid $gray_2;
  border-left: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  border-radius: 4px 0px 0 4px;
  height: calc(100% - 94px);
  position: absolute;
  right: 0;
  top: 0;
  transform: translate3d(100%, 72px, 0);
  transition: transform .3s ease-out;
  width: 300px;
  will-change: transform;
  z-index: 3;
  &.visible {
    transform: translate3d(0, 72px, 0);

  }
}
.models-list-scroll {
  height: 100%;
  overflow: hidden;
  background: $gray_1;
  border-radius: 4px 0px 0 4px;
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
