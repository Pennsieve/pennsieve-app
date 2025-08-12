<script setup>
import { ref, watch, computed } from "vue";
import { useStore } from "vuex";
import BfWaitingIcon from "../../shared/bf-waiting-icon/bf-waiting-icon.vue";

/* 
Props
*/
const props = defineProps([
  "dialogVisible",
  "selectedNode",
  "selectedApplication",
]);

/* 
Local State
*/
const isLoading = ref(false);
const TableData = ref();
const noLogsAvailable = ref(false);
const logsPending = ref(false);

/*
Emits
*/
const emit = defineEmits(["close-dialog"]);

/* 
Global State
*/
const store = useStore();

const LogList = computed(() => store.getters["analysisModule/workflowLogs"]);

/*
Watch
*/
watch(
  // Fetch Logs on Workflow Change from Vuex Store
  () => props.selectedNode,
  async (newval, oldval) => {
    if (!props.selectedNode.uuid) {
      return;
    }
    try {
      isLoading.value = true;
      await store.dispatch("analysisModule/fetchWorkflowLogs", [
        props.selectedApplication,
        props.selectedNode,
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  }
);

watch(LogList, () => {
  // Build table to display logs
  LogList.value.length ? buildTable() : (noLogsAvailable.value = true);
});

/* 
Build Table for Logs 
*/
function buildTable() {
  noLogsAvailable.value = false;
  let _tempArr = [];
  LogList.value.forEach((log) => {
    let column = {
      CreationTime: log.utcTime,
      Message: log.message,
    };
    _tempArr.push(column);
  });
  TableData.value = _tempArr;
}

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
    @update:modelValue="dialogVisible = $event"
    class="large-dialog"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Activity Logs" />
    </template>
    <dialog-body class="activity-log-body">
      <div v-if="isLoading" class="icon-waiting mr-16">
        <bf-waiting-icon />
      </div>
      <div v-else>
        <div v-if="logsPending">Logs Pending...</div>
        <div v-if="noLogsAvailable">No Logs Available</div>
        <div v-else>
          <el-table :data="TableData" class="tw-text-sm log-table">
            <el-table-column type="expand">
              <template #default="property">
                <div>
                  <p>{{ property.row.Message }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="CreationTime"
              label="Creation Time"
              width="200"
              show-overflow-tooltip
            />
            <el-table-column prop="Message" label="Message" />
          </el-table>
        </div>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.icon-waiting {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 24px;
  justify-content: center;
  width: 24px;
}
.activity-log-body {
  height: 79%;
  overflow: hidden;
  .log-table {
    height: 63vh;
  }
  padding: 24px 32px;
  background-color: theme.$white;
}
</style>
