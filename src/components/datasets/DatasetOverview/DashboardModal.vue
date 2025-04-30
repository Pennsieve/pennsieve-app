<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { PublicationStatus } from '../../../utils/constants';

/* 
Props
*/
const props = defineProps({
  dialogVisible: Boolean,
});


/*
Emits
*/
const emit = defineEmits(["close-dialog"]);

/* 
Global State
*/
const store = useStore();
const dataset = computed(() => store.state.dataset);
/*
Computed
*/
const publicationStatus = computed(() => {
  return (dataset.value?.publication?.status ?? PublicationStatus.DRAFT).toUpperCase();
});

const filesCount = computed(() => {
  const counts = dataset.value?.packageTypeCounts;
  return counts ? Object.values(counts).filter(Number.isFinite).reduce((sum, val) => sum + val, 0).toString() : "0";
});

const collaboratorCounts = computed(()=>{
  const counts = dataset.value?.collaboratorCounts;
  return counts ? Object.values(counts).filter(Number.isFinite).reduce((sum, val) => sum + val, 0).toString() : "0";
})

const dashboardOptions = computed(() => ({
  globalData: {
    FileCount: filesCount.value,
    Status: publicationStatus.value,
    CollaboratorCounts: collaboratorCounts.value
  }
}));

/* 
Local State
*/

const dashboardItems=
[{ id: "TextWidget-1", x: 0, y: 0, h: 1, w:4, componentName:"Text",component:"TextWidget",hideHeader:true, Props:{displayText:"Dataset Overview",hideHeader:true} },
{ id: "TextWidget-2", x: 0, y: 1, h: 2, w:1, componentName:"Files",component:"TextWidget",Props:{bindedKey:"FileCount"} },
{ id: "TextWidget-3", x: 1, y: 1, h: 2, w:2, componentName:"Status",component:"TextWidget",Props:{bindedKey:"Status"}},
{ id: "TextWidget-4", x: 3, y: 1, h: 2, w:2, componentName:"Collaborator Counts",component:"TextWidget",Props:{bindedKey:"CollaboratorCounts"}}];

/*
Closes the dialog
*/
function closeDialog() {
  emit("close-dialog", false);
}
</script>

<template>
  <el-dialog
    :modelValue="dialogVisible"
    class="full-dialog"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header class="dialog-dash-header" slot="title" title="Overview Dashboard" />
    </template>
    <dialog-body>
        <Sparc-Dashboard :dBItems="dashboardItems" :hideHeader="true" :options="dashboardOptions"></Sparc-Dashboard>
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
    --el-dialog-width: 90%;
    --dash-secondary: #243d8e;
}

:deep(.dash-header){
    background-color: transparent;
    padding-top: 10px;
}
:deep(.widget-body){
    margin: auto;
    min-width: 50px;
    margin-top: 20px;
    text-align: center;
}  

</style>
<style>
.el-dialog__title {
  color: white;
}</style>
