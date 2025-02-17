<script setup>
import 'sparc-dashboard-beta/dist/style.css'
import { computed } from 'vue';
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
  console.log(dataset.value)
  return (dataset.value?.publication?.status ?? PublicationStatus.DRAFT).toUpperCase();
});

const filesCount = computed(() => {
   if(dataset.value?.packageTypeCounts){
    return Object.values(dataset.value.packageTypeCounts)
      .filter(value => typeof value === 'number') 
      .reduce((sum, value) => sum + value, 0);
   }
});

const collaboratorCounts = computed(()=>{
  if(dataset.value?.collaboratorCounts){
    return Object.values(dataset.value.collaboratorCounts)
      .filter(value => typeof value === 'number') 
      .reduce((sum, value) => sum + value, 0);
   }
})
/* 
Local State
*/

const dashboardItems=
[{ id: "TextWidget-1", x: 0, y: 0, h: 1, w:4, componentName:"Text",component:"TextWidget",Props:{displayText:"Dastaset Overview",hideHeader:true} },
{ id: "CountWidget-2", x: 0, y: 1, h: 2, w:1, componentName:"File Count",component:"CountWidget",Props:{count:filesCount} },
{ id: "TextWidget-3", x: 1, y: 1, h: 2, w:2, componentName:"Status",component:"TextWidget",Props:{displayText:publicationStatus}},
{ id: "TextWidget-4", x: 3, y: 1, h: 2, w:2, componentName:"Collaborator Counts",component:"TextWidget",Props:{displayText:collaboratorCounts}}];


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
        <Sparc-Dashboard :dBItems="dashboardItems"></Sparc-Dashboard>
    </dialog-body>
  </el-dialog>
</template>

<style lang="scss" scoped>
@import "../../../assets/_variables.scss";

.full-dialog{
padding: 0px;
}
.dialog-dash-header{
    height: 40px;
    margin-left: 10px;
}
:deep(.dash-header){
    background-color: transparent;
}
:deep(.widget-body){
    margin: auto;
    min-width: 50px;
    margin-top: 20px;
}  
</style>
