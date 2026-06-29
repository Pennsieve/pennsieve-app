<template>
  <div class="public-dataset-record">
    <router-link
      :to="{ name: 'public-dataset-records', params: { datasetId, model: modelName } }"
      class="back-link"
    >
      <IconArrowLeft :width="16" :height="16" color="currentColor" />
      <span>{{ model ? model.displayName : "Records" }}</span>
    </router-link>

    <div v-if="isLoading" class="state" v-loading="true">
      <p>Loading record...</p>
    </div>

    <div v-else-if="!record" class="state">
      <h3>Record not found</h3>
      <p>This record may no longer exist in the dataset.</p>
    </div>

    <template v-else>
      <h2 class="record-title">{{ recordTitle }}</h2>

      <!-- Properties -->
      <div class="record-section">
        <div class="file-list">
          <concept-instance-static-property
            v-for="prop in properties"
            :key="prop.key"
            :label="prop.label"
          >
            {{ formatValue(prop.value) }}
          </concept-instance-static-property>
        </div>
      </div>

      <!-- Attached files -->
      <div v-if="files.length" class="record-section">
        <h3 class="section-title">Files</h3>
        <ul class="file-links">
          <li v-for="f in files" :key="f.path">
            <router-link
              :to="{ name: 'public-dataset-file-details', params: { datasetId }, query: { path: f.path } }"
            >
              {{ f.path }}
            </router-link>
          </li>
        </ul>
      </div>

      <!-- Relationships -->
      <div v-if="relationshipRows.length" class="record-section">
        <h3 class="section-title">Relationships</h3>
        <table class="rel-table">
          <tbody>
            <tr v-for="(rel, i) in relationshipRows" :key="i">
              <td class="rel-dir">{{ rel.direction === "out" ? "→" : "←" }}</td>
              <td class="rel-type">{{ rel.type }}</td>
              <td class="rel-target">
                <router-link
                  v-if="rel.model"
                  :to="{
                    name: 'public-dataset-record',
                    params: { datasetId, model: rel.model, recordId: rel.recordId },
                  }"
                >
                  {{ rel.label }}
                </router-link>
                <span v-else class="rel-id">{{ rel.label }}</span>
              </td>
              <td class="rel-model">{{ rel.model ? humanize(rel.model) : "" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import ConceptInstanceStaticProperty from "@/components/datasets/explore/ConceptInstance/ConceptInstanceStaticProperty.vue";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const route = useRoute();
const store = useReadOnlyDatasetStore();

const model = ref(null);
const record = ref(null);
const relationships = ref({ outbound: [], inbound: [] });
const resolvedMap = ref({});
const files = ref([]);
const isLoading = ref(false);

const datasetId = computed(() => props.dataset.id);
const modelName = computed(() => route.params.model);
const recordId = computed(() => route.params.recordId);

const properties = computed(() => {
  const schemaProps = model.value?.properties || {};
  const value = record.value?.value || {};
  return Object.entries(schemaProps).map(([key, prop]) => ({
    key,
    label: prop?.title || key,
    value: value[key],
  }));
});

const recordTitle = computed(() => {
  const value = record.value?.value || {};
  return value[model.value?.titleProperty] || recordId.value;
});

const relationshipRows = computed(() => {
  const out = relationships.value.outbound.map((r) => ({
    direction: "out",
    type: r.relationship_type,
    recordId: r.target_record_id,
  }));
  const inb = relationships.value.inbound.map((r) => ({
    direction: "in",
    type: r.relationship_type,
    recordId: r.source_record_id,
  }));
  return [...out, ...inb].map((r) => {
    const resolved = resolvedMap.value[r.recordId];
    return {
      ...r,
      label: resolved?.label || r.recordId,
      model: resolved?.model || null,
    };
  });
});

const load = async () => {
  isLoading.value = true;
  try {
    model.value = await store.getModel(
      props.dataset.id,
      props.dataset.version,
      modelName.value
    );
    record.value = await store.getRecord({
      id: props.dataset.id,
      version: props.dataset.version,
      model: model.value.name,
      modelVersion: model.value.modelVersion,
      recordId: recordId.value,
    });

    // Relationships + files are best-effort (not all datasets have them).
    const [rels, recFiles] = await Promise.all([
      store.getRecordRelationships({
        id: props.dataset.id,
        version: props.dataset.version,
        recordId: recordId.value,
      }),
      store.getRecordFiles({
        id: props.dataset.id,
        version: props.dataset.version,
        recordId: recordId.value,
      }),
    ]);
    relationships.value = rels;
    files.value = recFiles;

    // Resolve related record ids to labels + owning model (for linking).
    // Best-effort — failure just leaves relationships showing raw ids.
    const relatedIds = [
      ...rels.outbound.map((r) => r.target_record_id),
      ...rels.inbound.map((r) => r.source_record_id),
    ];
    try {
      resolvedMap.value = await store.resolveRecords(
        props.dataset.id,
        props.dataset.version,
        relatedIds
      );
    } catch (e) {
      console.warn("Could not resolve related records:", e);
      resolvedMap.value = {};
    }
  } catch (e) {
    console.error("Error loading record:", e);
    record.value = null;
  } finally {
    isLoading.value = false;
  }
};

onMounted(load);
watch(recordId, load);

const formatValue = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
};

const humanize = (name) =>
  String(name)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

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

.record-title {
  font-size: 22px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 24px 0;
  word-break: break-word;
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

.record-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  padding-bottom: 8px;
  margin: 0 0 12px 0;
  border-bottom: 1px solid theme.$gray_2;
}

.file-list {
  border-top: 1px solid theme.$gray_2;
}

.file-links {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;

  a {
    color: theme.$purple_2;
  }
}

.rel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  td {
    padding: 6px 12px;
    border-bottom: 1px solid theme.$gray_1;
    color: theme.$gray_5;
  }

  .rel-dir {
    width: 24px;
    color: theme.$gray_4;
  }

  .rel-type {
    font-weight: 600;
    color: theme.$gray_6;
    white-space: nowrap;
  }

  .rel-target a {
    color: theme.$purple_2;
  }

  .rel-id {
    font-family: monospace;
    color: theme.$gray_4;
  }

  .rel-model {
    font-size: 12px;
    color: theme.$gray_4;
    text-align: right;
    white-space: nowrap;
  }
}
</style>
