<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { PublicationStatus } from '../../../utils/constants';

/* 
Props
*/
const props = defineProps([
  "dialogVisible",
]);


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
   if(dataset.value?.packageTypeCounts){
    const allCount = Object.values(dataset.value.packageTypeCounts)
      .filter(value => typeof value === 'number') 
      .reduce((sum, value) => sum + value, 0);
      return allCount.toString();
   }
});

const collaboratorCounts = computed(()=>{
  if(dataset.value?.collaboratorCounts){
    const allCount = Object.values(dataset.value.collaboratorCounts)
      .filter(value => typeof value === 'number') 
      .reduce((sum, value) => sum + value, 0);
      return allCount.toString();
   }
})
/* 
Local State
*/

const dashboardItems=
[{ id: "TextWidget-1", x: 0, y: 0, h: 1, w:4, componentName:"Text",component:"TextWidget",hideHeader:true, Props:{displayText:"Dastaset Overview",hideHeader:true} },
{ id: "TextWidget-2", x: 0, y: 1, h: 2, w:1, componentName:"Files",component:"TextWidget",Props:{bindedKey:"FileCount"} },
{ id: "TextWidget-3", x: 1, y: 1, h: 2, w:2, componentName:"Status",component:"TextWidget",Props:{bindedKey:"Status"}},
{ id: "TextWidget-4", x: 3, y: 1, h: 2, w:2, componentName:"Collaborator Counts",component:"TextWidget",Props:{bindedKey:"CollaboaratorCount"}}];

  //options object ot pass the Dashboard. 
  const dashboardOptions =ref({
  //key value pairs that can be accessed to the user from high-configurable widgets. 
  globalData:{
    FileCount:filesCount,
    Status:publicationStatus,
    CollaboaratorCount:collaboratorCounts
  }
})
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
