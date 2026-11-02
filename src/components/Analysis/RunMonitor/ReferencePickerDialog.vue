<script setup>
/*
  Choosing the catalog reference that fills a step input (a reference
  source): the references the input can take, from environments-service's
  catalog (its asset class and tool versions, the organisms it offers), with
  the picked one's details beside them. Used from the workflow builder (the
  workflow's default) and a run's configure page (this run's).
*/
import { computed, ref, watch } from "vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { findReferences } from "@/utils/environmentsService";
import {
  catalogQuery,
  fitsInput,
  isAppDefault,
  offeredOrganisms,
  organismName,
  referenceDetails,
  referenceKindText,
  referenceLabel,
  sortReferences,
  formatSize,
} from "./referenceSources";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The input's app.yml reference block.
  reference: { type: Object, default: null },
  // What it fills, for the title: the step and its input.
  stepName: { type: String, default: "" },
  inputName: { type: String, default: "" },
  // The reference chosen now (environmentId), if any.
  selectedId: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "pick"]);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const entries = ref([]);
const loading = ref(false);
const error = ref("");
const pickedId = ref("");
const organism = ref(0);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const found = await findReferences(catalogQuery(props.reference));
    entries.value = sortReferences(found.filter((e) => fitsInput(e, props.reference)), props.reference);
  } catch (e) {
    entries.value = [];
    error.value = e?.message || "Couldn't load the reference catalog.";
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    pickedId.value = props.selectedId;
    organism.value = 0;
    load();
  },
  { immediate: true }
);

// The organism filter: shown when the input offers more than one.
const organisms = computed(() => {
  const offered = offeredOrganisms(props.reference);
  const ids = offered.length ? offered : [...new Set(entries.value.map((e) => e.version?.spec?.taxonomyId).filter(Boolean))];
  return ids.map((id) => {
    const e = entries.value.find((x) => Number(x.version?.spec?.taxonomyId) === Number(id));
    return { id: Number(id), name: organismName(id, e?.version?.spec?.organism) };
  });
});
const listed = computed(() =>
  organism.value ? entries.value.filter((e) => Number(e.version?.spec?.taxonomyId) === organism.value) : entries.value
);

// Before anything is picked, the app's default shows on the left.
const picked = computed(
  () =>
    entries.value.find((e) => e.id === pickedId.value) ||
    (!pickedId.value && entries.value.find((e) => isAppDefault(e, props.reference))) ||
    null
);
const details = computed(() => (picked.value ? referenceDetails(picked.value) : null));
const pickedIsDefault = computed(() => !!picked.value && isAppDefault(picked.value, props.reference));

const title = computed(() =>
  props.stepName && props.inputName ? `Choose a reference for ${props.stepName} › ${props.inputName}` : "Choose a reference"
);
const what = computed(() => referenceKindText(props.reference));

const confirm = (entry = picked.value) => {
  if (!entry) return;
  emit("pick", entry);
  visible.value = false;
};
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="960px" :close-on-click-modal="false" append-to-body class="reference-picker-dialog">
    <div class="rp">
      <aside class="rp__side">
        <template v-if="details">
          <h3 class="rp__name">{{ details.label }}</h3>
          <div class="rp__meta">
            <span>Version {{ details.version }}</span>
            <span v-if="details.sizeBytes">· {{ formatSize(details.sizeBytes) }}</span>
            <span v-if="pickedIsDefault" class="rp__badge">App default</span>
          </div>
          <p v-if="details.description" class="rp__text">{{ details.description }}</p>
          <section class="rp__section">
            <h4>Reference</h4>
            <dl class="rp__facts">
              <template v-if="details.organism"><dt>Organism</dt><dd>{{ details.organism }}</dd></template>
              <template v-if="details.assembly"><dt>Assembly</dt><dd>{{ details.assembly }}</dd></template>
              <template v-if="details.annotation"><dt>Annotation</dt><dd>{{ details.annotation }}</dd></template>
              <template v-if="details.tool"><dt>Built with</dt><dd>{{ details.tool }}</dd></template>
              <template v-for="p in details.properties" :key="p.name"><dt>{{ p.name }}</dt><dd>{{ p.value }}</dd></template>
              <template v-if="details.unpackedBytes"><dt>On the step's disk</dt><dd>{{ formatSize(details.unpackedBytes) }}</dd></template>
              <template v-if="details.license"><dt>License</dt><dd>{{ details.license }}</dd></template>
            </dl>
          </section>
          <section v-if="details.citation" class="rp__section">
            <h4>Cite</h4>
            <p class="rp__cite">{{ details.citation }}</p>
          </section>
        </template>
        <p v-else class="rp__empty">Choose a reference to see what it is.</p>
      </aside>

      <div class="rp__main">
        <p class="rp__desc">{{ what }}. The step downloads the one you choose when it runs; each run records the exact version it used.</p>
        <div v-if="organisms.length > 1" class="rp__filters" role="group" aria-label="Organism">
          <button type="button" class="rp__filter" :class="{ on: !organism }" @click="organism = 0">All</button>
          <button v-for="o in organisms" :key="o.id" type="button" class="rp__filter" :class="{ on: organism === o.id }" @click="organism = o.id">
            {{ o.name }}
          </button>
        </div>
        <div class="rp__cards">
          <div v-if="loading" class="rp__cards-empty">Loading the reference catalog...</div>
          <div v-else-if="error" class="rp__cards-empty">{{ error }}</div>
          <button
            v-for="e in listed"
            :key="e.id"
            type="button"
            class="rp__card"
            :class="{ picked: picked && e.id === picked.id }"
            @click="pickedId = e.id"
            @dblclick="confirm(e)"
          >
            <span class="rp__card-name">{{ referenceLabel(e) }}</span>
            <span class="rp__card-desc">
              Version {{ e.version?.version || e.latestVersion }}<template v-if="e.version?.archive?.sizeBytes"> · {{ formatSize(e.version.archive.sizeBytes) }}</template>
            </span>
            <span v-if="isAppDefault(e, reference)" class="rp__badge">App default</span>
          </button>
          <div v-if="!loading && !error && listed.length === 0" class="rp__cards-empty">The catalog has no reference this input can take yet.</div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="rp__footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :disabled="!picked" @click="confirm()">Use this reference</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.rp {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: min(520px, calc(100vh - 260px));
  border-top: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
}
.rp__side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  background: theme.$gray_0;
  border-right: 1px solid theme.$gray_2;
  overflow-y: auto;

  > * {
    flex-shrink: 0;
  }
}
.rp__name {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: theme.$black;
  overflow-wrap: anywhere;
}
.rp__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.rp__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: theme.$gray_5;
}
.rp__section {
  h4 {
    margin: 6px 0 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: theme.$gray_4;
  }
}
.rp__facts {
  margin: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  font-size: 13px;

  dt {
    color: theme.$gray_4;
    font-size: 12px;
  }
  dd {
    margin: 0;
    color: theme.$gray_6;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
}
.rp__cite {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
}
.rp__empty {
  margin: auto 0;
  font-size: 13px;
  color: theme.$gray_4;
  text-align: center;
}
.rp__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px;
  overflow: hidden;
}
.rp__desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_4;
}
.rp__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.rp__filter {
  padding: 4px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;

  &.on {
    border-color: theme.$purple_1;
    background: theme.$purple_tint;
  }
}
.rp__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
}
.rp__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_0;
  }
  &.picked {
    border-color: theme.$purple_1;
    background: theme.$purple_tint;
  }
}
.rp__card-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
}
.rp__card-desc {
  margin-top: 2px;
  font-size: 12px;
  color: theme.$gray_4;
}
.rp__badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  font-size: 10px;
  color: theme.$gray_5;
}
.rp__meta .rp__badge {
  margin-top: 0;
}
.rp__cards-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}
.rp__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
</style>

<style lang="scss">
/* The two columns reach the dialog's edges (the body's padding goes); the
   dialog is appended to body, so this isn't scoped. */
.reference-picker-dialog .el-dialog__body {
  padding: 0;
}
</style>
