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
    CollaboratorCounts: collaboratorCounts.value,
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
    class="dashboard-modal"
    fullscreen
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
@import "../../../../src/assets/_variables.scss";

.dashboard-app{
    --el-color-primary: #011F5B;
    --el-color-primary-light-3: #fbfdff;
    --el-color-primary-dark-2: #011F5B;
    --el-text-color-primary:white;
    --color:#4d628c;
    --el-dialog-width: 90%;
    --dash-secondary: #4d628c;
    background: none;

}

:deep(.dash-header){
    background-color: transparent;
    padding: 10px 0 10px 0;
}
:deep(.widget-body){
    margin: auto;
    min-width: 50px;
    margin-top: 20px;
    text-align: center;
}  

</style>
<style lang="scss">

.full-dialog-dashboard .el-dialog__title {
  color: white;
}
.full-dialog-dashboard .el-dialog__footer .el-button {
  margin-bottom: 10px;
  background-color: $purple_3;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  flex-direction: row;
  font-size: 14px;
  justify-content: center;
  line-height: 1;
  margin: 0;
  margin-right: 0px;
  min-width: 160px;
  outline: none;
  padding: 12px 16px;
  text-transform: none;
  min-height: 40px;

  &:hover {
    background-color: $purple_3;
    color: white;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);

    // Fix: also style the span inside
    .el-button__text {
      color: #011F5B;
    }
  }
}
.full-dialog-dashboard .el-dialog__footer .secondary{
    background:
  #F7F7F7;
    border-color:
  #d3d5da;
    color: #4d4d4d;
    &:hover{
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
      background-color:#eeeeee;
      color: #4d4d4d;
      border:inherit
    }
}


.dashboard-modal .el-dialog__body{
  background-color: $purple_tint;
  .edit-button{
    margin-bottom: 10px;
    background-color: $purple_3;
    align-items: center;
        background:
      #011F5B;
        border:
      1px solid transparent;
        border-radius:
      3px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        flex-direction: row;
        font-size: 14px;
        justify-content: center;
        line-height: 1;
        margin:
      0;
          margin-right: 0px;
        min-width: 160px;
        outline:
      none;
        padding:
      12px 16px;
        text-transform: none;
        min-height: 40px;
        &:hover{
          background-color: $purple_3;
          color:white;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);

        }
  }
}

</style>
