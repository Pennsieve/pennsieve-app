<template>
  <div class="public-dataset-records">
    <router-link :to="{ name: 'public-dataset-metadata', params: { datasetId } }" class="back-link">
      <IconArrowLeft :width="16" :height="16" color="currentColor" />
      <span>Models</span>
    </router-link>

    <div class="records-header">
      <div class="records-title">
        <h2>{{ model ? model.displayName : modelName }}</h2>
        <span v-if="!isLoading" class="records-count">{{ totalCount }} records</span>
      </div>
      <el-input
        v-model="search"
        class="records-search"
        placeholder="Search records…"
        clearable
        @input="onSearchInput"
      />
    </div>

    <div v-if="isLoading" class="state" v-loading="true">
      <p>Loading records...</p>
    </div>

    <div v-else-if="error" class="state">
      <h3>Unable to load records</h3>
      <p>Something went wrong querying this model's records.</p>
    </div>

    <div v-else-if="records.length === 0" class="state">
      <p>This model has no records.</p>
    </div>

    <template v-else>
      <el-table
        :data="records"
        class="modern-table"
        :border="true"
        row-class-name="clickable-row"
        @row-click="openRecord"
        @sort-change="onSortChange"
      >
        <el-table-column
          v-for="column in columns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          sortable="custom"
          min-width="160"
        >
          <template #default="{ row }">
            {{ formatCellValue(row.value[column.key]) }}
          </template>
        </el-table-column>
      </el-table>

      <div v-if="totalCount > pageSize" class="pagination-container">
        <el-pagination
          :page-size="pageSize"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="totalCount"
          @current-change="onPageChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();
const store = useReadOnlyDatasetStore();

const model = ref(null);
const records = ref([]);
const totalCount = ref(0);
const currentPage = ref(1);
const pageSize = ref(25);
const isLoading = ref(false);
const error = ref(false);
const search = ref("");
const orderBy = ref("");
const orderDir = ref("asc");
let searchTimer = null;

const datasetId = computed(() => props.dataset.id);
const modelName = computed(() => route.params.model);

const columns = computed(() => {
  const props_ = model.value?.properties || {};
  return Object.entries(props_).map(([key, prop]) => ({
    key,
    label: prop?.title || key,
  }));
});

const loadModel = async () => {
  model.value = await store.getModel(
    props.dataset.id,
    props.dataset.version,
    modelName.value
  );
};

const loadPage = async () => {
  if (!model.value) return;
  const result = await store.queryRecords({
    id: props.dataset.id,
    version: props.dataset.version,
    model: model.value.name,
    modelVersion: model.value.modelVersion,
    limit: pageSize.value,
    offset: (currentPage.value - 1) * pageSize.value,
    search: search.value,
    orderBy: orderBy.value,
    orderDir: orderDir.value,
  });
  records.value = result.records;
  totalCount.value = result.totalCount;
};

// Reload from page 1 (used by search + sort), with a loading guard.
const reload = async () => {
  currentPage.value = 1;
  isLoading.value = true;
  try {
    await loadPage();
  } catch (e) {
    console.error("Error loading records:", e);
  } finally {
    isLoading.value = false;
  }
};

const onSearchInput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reload, 300);
};

const onSortChange = ({ prop, order }) => {
  // el-table order: 'ascending' | 'descending' | null
  orderBy.value = order ? prop : "";
  orderDir.value = order === "descending" ? "desc" : "asc";
  reload();
};

const load = async () => {
  isLoading.value = true;
  error.value = false;
  currentPage.value = 1;
  search.value = "";
  orderBy.value = "";
  orderDir.value = "asc";
  try {
    await loadModel();
    await loadPage();
  } catch (e) {
    console.error("Error loading records:", e);
    error.value = true;
    records.value = [];
    totalCount.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const openRecord = (row) => {
  router.push({
    name: "public-dataset-record",
    params: {
      datasetId: datasetId.value,
      model: modelName.value,
      recordId: row.id,
    },
  });
};

const onPageChange = async (page) => {
  currentPage.value = page;
  isLoading.value = true;
  try {
    await loadPage();
  } catch (e) {
    console.error("Error loading records page:", e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(load);
watch(modelName, load);

const formatCellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    const shown = value.slice(0, 3).join(", ");
    return value.length > 3 ? `${shown}, … +${value.length - 3} more` : shown;
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
};
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';
@use "../../../styles/element/table";

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: theme.$purple_2;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 16px;

  &:hover {
    text-decoration: underline;
  }
}

.records-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0;
  }
}

.records-title {
  display: flex;
  align-items: baseline;
  gap: 12px;

  .records-count {
    font-size: 13px;
    color: theme.$gray_4;
  }
}

.records-search {
  max-width: 280px;
}

.state {
  padding: 32px 24px;
  text-align: center;
  color: theme.$gray_4;

  h3 {
    color: theme.$gray_5;
    font-weight: 300;
    margin: 0 0 8px 0;
  }
}

.modern-table {
  :deep(th) {
    background: theme.$gray_1 !important;
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_5;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  :deep(td) {
    font-size: 13px;
  }

  :deep(.clickable-row) {
    cursor: pointer;
  }

  :deep(.clickable-row:hover > td) {
    background: theme.$gray_1 !important;
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
