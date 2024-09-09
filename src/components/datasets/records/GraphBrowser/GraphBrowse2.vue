<script setup>
import { nextTick, ref } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import ModelsList from "@/components/datasets/records/ModelsList/ModelsList.vue";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";
import * as site from '../../../../site-config/site.json';
import { MarkerType } from '@vue-flow/core'
import { useLayout } from './useLayout'

import {useHandleXhrError, useSendXhr} from '@/mixins/request/request_composable'

import { computed } from 'vue';
import { useStore } from 'vuex';
import {pathOr} from "ramda";
import {useRoute} from "vue-router";
import ModelNode from './ModelNode.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import CreateConceptDialog from "@/components/datasets/management/CreateConceptDialog/CreateConceptDialog.vue";



const route = useRoute()
const store = useStore()

const { layout } = useLayout()

/**
 * `useVueFlow` provides:
 * 1. a set of methods to interact with the VueFlow instance (like `fitView`, `setViewport`, `addEdges`, etc)
 * 2. a set of event-hooks to listen to VueFlow events (like `onInit`, `onNodeDragStop`, `onConnect`, etc)
 * 3. the internal state of the VueFlow instance (like `nodes`, `edges`, `viewport`, etc)
 */
const { onInit, onNodeDragStop, onConnect, addEdges, fitView } = useVueFlow()

let edges = ref()
let nodes = ref()

let createConceptDialogVisible = ref(false)


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
  const datasetId = pathOr('', ['params', 'datasetId'])(route)
  if (apiUrl && datasetId) {
    return `${apiUrl}/datasets/${datasetId}/concepts/schema/graph`
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

      nodes.value = layout(nodes.value, edges.value, 'TB')

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

  // TODO: Merge edges when multiple relationships exists between two models
  // e.g. Person 'listens' to CD and Person 'has' CD.

  const nodes = []
  const edges = []

  data.forEach(obj => {
    if (obj.type && (obj.type === 'schemaRelationship' || obj.type === 'schemaLinkedProperty')) {
      const hasFromNode = data.findIndex(d => d.id === obj.from) >= 0
      const hasToNode = data.findIndex(d => d.id === obj.to) >= 0

      if (hasFromNode && hasToNode) {

        const strokeColor = obj.type === "schemaRelationship" ? "#011F5B" : "#F9A23A"

        const curObject = {
          id: obj.id,
          type: 'smoothstep',
          source: obj.from,
          target: obj.to,
          label: obj.displayName,
          markerEnd: MarkerType.ArrowClosed,
          style: { stroke: strokeColor },
        }

        edges.push(curObject)
      }
    } else {
      const curObject = {
        id: obj.id,
        type: 'custom',
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

/**
 * onConnect is called when a new connection is created.
 *
 * You can add additional properties to your new edge (like a type or label) or block the creation altogether by not calling `addEdges`
 */
onConnect((connection) => {
  // TODO: open create relationship modal.

  addEdges(connection)
})

</script>

<template>

  <div class="graph-browser">
    <div class="vue-flow-wrapper">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :class="{ dark }"
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

    <div
      class="models-list-wrap"
      :class="{ 'visible': modelsListVisible }"
    >

      <button
        class="btn-toggle-models-list"
        @click="toggleModelsList"
      >
        <IconArrowRight
          :class="[ modelsListArrowDir === 'left' ? 'svg-flip' : '' ]"
          :height="16"
          :width="16"
        />
      </button>
      <div
        ref="modelsList"
        class="models-list-scroll"
      >

        <models-list
          :show-heading="false"
          :is-link="false"
          :scrolling-list="true"
          :models="nodes"
          @click="focusNode"
        />
      </div>
    </div>
  </div>

  <create-concept-dialog
    :dialog-visible="createConceptDialogVisible"
    @close="closeCreateConceptDialog"
  />

<!--  </bf-stage>-->
</template>

<style lang="sass" >


/* these are necessary styles for vue flow */
@import '@vue-flow/core/dist/style.css'

/* this contains the default theme, these are optional styles */
@import '@vue-flow/core/dist/theme-default.css'
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
}
.btn-toggle-models-list {
  align-items: center;
  background: $gray_1;
  border-left: 1px solid $gray_2;
  border-top: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  display: flex;
  height: 32px;
  left: -33px;
  justify-content: center;
  position: absolute;
  top: 33px;
  width: 33px;
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


</style>
