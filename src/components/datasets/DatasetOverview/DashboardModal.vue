<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { PublicationStatus } from '../../../utils/constants'
import { PennsieveDashboard, MarkdownWidget, TextWidget } from 'pennsieve-dashboard'
import 'element-plus/dist/index.css';
import 'pennsieve-dashboard/style.css'


// props / emits
const props = defineProps({ dialogVisible: Boolean })
const emit  = defineEmits(['close-dialog'])

// store
const store   = useStore()
const dataset = computed(() => store.state.dataset)

// Computed
const publicationStatus = computed(() =>
  (dataset.value?.publication?.status ?? PublicationStatus.DRAFT).toUpperCase()
)

const filesCount = computed(() => {
  const counts = dataset.value?.packageTypeCounts
  return counts
    ? Object.values(counts).filter(Number.isFinite).reduce((sum, v) => sum + v, 0).toString()
    : '0'
})

const collaboratorCounts = computed(() => {
  const counts = dataset.value?.collaboratorCounts
  return counts
    ? Object.values(counts).filter(Number.isFinite).reduce((sum, v) => sum + v, 0).toString()
    : '0'
})

// Component Options
const availableWidgets = [
  { name: 'TextWidget', component: TextWidget },
  { name: 'MarkdownWidget', component: MarkdownWidget },
]

const defaultLayout = [
        {
          id: 'MarkdownWidget-6',
          x: 0, y: 0, w: 4, h: 7,
          componentKey: 'MarkdownWidget',
          componentName: 'Markdown Widget',
          component: MarkdownWidget,   
          Props:{
            markdownText:[
          '# Dataset Overview',
          '',
          'This dashboard gives you an at-a-glance overview of the metrics of your Dataset',
          '',
          '## Widgets',
          '',
          '### Text Widgets',
          'These are customizable and allow you to track the variables that are important to you. *Click on the pencil icon to edit*',
          '',
          'Click **Edit Grid** to add or rearrange widgets',
          '',
        ].join('\n')
          }
        },
        { 
          id: "TextWidget-2", 
          x: 4, y: 0, h: 2, w:1, 
          componentName:"Files",
          componentKey:"TextWidget",
          component:TextWidget,
          Props:{bindedKey:"FileCount"} 
        },
        { 
          id: "TextWidget-3", 
          x: 5, y: 0, h: 2, w:2, 
          componentName:"Status",
          componentKey:"TextWidget",
          component:TextWidget,
          Props:{bindedKey:"Status"}
        },
        { 
          id: "TextWidget-4", 
          x: 4, y: 2, h: 2, w:2, 
          componentName:"Collaborator Counts",
          componentKey:"TextWidget",
          component:TextWidget,
          Props:{bindedKey:"CollaboratorCounts"}}
      ]

const dashboardOptions = computed(() => ({
  globalData: {
    FileCount: filesCount.value,
    Status: publicationStatus.value,
    CollaboratorCounts: collaboratorCounts.value,
  },
  availableWidgets,
  defaultLayout,
}))

// Dashboard Key
const dashboardKey = computed(() => String(dataset.value?.content?.id ?? 'none'))

function closeDialog () {
  emit('close-dialog', false)
}
</script>

<template>
  <el-dialog
    :modelValue="dialogVisible"
    class="full-dialog"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header class="dialog-dash-header" title="Overview Dashboard" />
    </template>

    <dialog-body>
      <!-- v-if avoids mounting with a stale/empty dataset -->
      <PennsieveDashboard
        v-if="dataset"
        :key="dashboardKey"
        class="dashboard-app"
        :options="dashboardOptions"
      />
    </dialog-body>
  </el-dialog>
</template>


<style lang="scss" scoped>
.dashboard-app{
    --el-color-primary: #243d8e;
    --el-color-primary-light-3: #fbfdff;
    --el-color-primary-dark-2: #546085;
    --el-text-color-primary:white;
    --color:#243d8e;
    --dash-secondary: #243d8e;
     background-color: #f6fcff;
     border: solid aliceblue;
}

</style>
<style>
.full-dialog{
  --el-dialog-width: 90%;
}
.el-dialog__title {
  color: white;
}
</style>
