<template>
  <div class="public-dataset-overview">
    <div class="header-row">
      <!-- Left: title, authors, description, metadata -->
      <div class="header-info">
        <h1 class="dataset-title">{{ dataset.name }}</h1>

        <div class="dataset-pills">
          <bf-pill class="blue">
            <span class="pill-with-icon">
              <component :is="sourceMeta.icon" :width="13" :height="13" color="currentColor" />
              {{ sourceMeta.label }}
            </span>
          </bf-pill>
          <bf-pill v-if="dataset.doi">DOI: {{ dataset.doi }}</bf-pill>
          <bf-pill v-if="dataset.version">Version {{ dataset.version }}<template v-if="dataset.revision">, Rev. {{ dataset.revision }}</template></bf-pill>
        </div>

        <div v-if="contributorNames.length" class="dataset-owners">
          {{ contributorNames.join(", ") }}
        </div>

        <p v-if="dataset.description" class="dataset-description">
          {{ dataset.description }}
        </p>

        <div class="dataset-meta">
          <div v-if="dataset.updatedAt" class="dataset-updated-date">
            Updated on {{ formatDate(dataset.updatedAt) }}
          </div>
          <div v-if="dataset.owner" class="dataset-corresponding-contributor">
            Corresponding Contributor: {{ dataset.owner }}
          </div>
        </div>

        <div v-if="dataset.tags && dataset.tags.length" class="tags">
          <span v-for="tag in dataset.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <!-- Right: banner image -->
      <div class="header-image-section">
        <img
          v-if="dataset.banner"
          class="dataset-image"
          :src="dataset.banner"
          :alt="`${dataset.name} banner`"
        />
      </div>
    </div>

    <!-- Stats row -->
    <div class="header-stats-section">
      <div class="header-stats-block">
        <IconFiles class="mr-8" :height="20" :width="20" color="#404554" />
        <div>
          <template v-if="dataset.fileCount > 0">
            <strong>{{ formatNumber(dataset.fileCount) }}</strong> Files
          </template>
          <template v-else>No Files</template>
        </div>
      </div>

      <div class="header-stats-block">
        <IconStorage class="mr-8" :height="20" :width="20" color="#404554" />
        <div><strong>{{ formatBytes(dataset.size) }}</strong></div>
      </div>

      <div class="header-stats-block">
        <IconDocument class="mr-8" :height="20" :width="20" color="#404554" />
        <div>
          <template v-if="dataset.recordCount > 0">
            <strong>{{ formatNumber(dataset.recordCount) }}</strong> Records
          </template>
          <template v-else>No Records</template>
        </div>
      </div>

      <div class="header-stats-block">
        <IconLicense class="mr-8" :height="20" :width="20" color="#404554" />
        <div>{{ dataset.license || "No License" }}</div>
      </div>
    </div>

    <!-- README + Citation as dashboard widgets (extensible) -->
    <StaticDashboard
      v-if="showDashboard"
      :key="dataset.id"
      class="overview-dashboard"
      :options="dashboardOptions"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, markRaw } from "vue";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import IconFiles from "@/components/icons/IconFiles.vue";
import IconStorage from "@/components/icons/IconStorage.vue";
import IconDocument from "@/components/icons/IconDocument.vue";
import IconLicense from "@/components/icons/IconLicense.vue";
import IconGlobeCheck from "@/components/icons/IconGlobeCheck.vue";
import IconEyeball from "@/components/icons/IconEyeball.vue";
import BfPill from "@/components/shared/BfPill/BfPill.vue";
import { StaticDashboard } from "pennsieve-dashboard";
import "pennsieve-dashboard/style.css";
import MarkdownPanelWidget from "@/components/datasets/DatasetOverview/widgets/MarkdownPanelWidget.vue";
import CitationPanelWidget from "./widgets/CitationPanelWidget.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const store = useReadOnlyDatasetStore();

// ---- README (rendered read-only in the dashboard wrapper) ----
const readmeContent = ref("");

const loadReadme = async () => {
  readmeContent.value = "";
  try {
    readmeContent.value = await store.getFileContent({
      id: props.dataset.id,
      version: props.dataset.version,
      path: "readme.md",
    });
  } catch (e) {
    console.warn("No README available:", e);
    readmeContent.value = "";
  }
};

// Extensible overview dashboard: README (left) + Citation (right). Layout
// adapts to whichever content exists. Add more widgets here as it grows.
const dashboardLayout = computed(() => {
  const hasReadme = !!readmeContent.value;
  const hasDoi = !!props.dataset.doi;
  const layout = [];
  if (hasReadme) {
    layout.push({
      id: "readme-widget",
      x: 0,
      y: 0,
      w: hasDoi ? 8 : 12,
      fillHeight: true,
      componentKey: "MarkdownPanelWidget",
      componentName: "README",
      component: markRaw(MarkdownPanelWidget),
      Props: { widgetName: "README", value: readmeContent.value, locked: true },
    });
  }
  if (hasDoi) {
    layout.push({
      id: "citation-widget",
      x: hasReadme ? 8 : 0,
      y: 0,
      w: hasReadme ? 4 : 12,
      fillHeight: true,
      componentKey: "CitationPanelWidget",
      componentName: "Citation",
      component: markRaw(CitationPanelWidget),
      Props: { widgetName: "Citation", doi: props.dataset.doi },
    });
  }
  return layout;
});

const showDashboard = computed(() => dashboardLayout.value.length > 0);

const dashboardOptions = computed(() => ({
  globalData: {},
  availableWidgets: [
    { name: "MarkdownPanelWidget", component: markRaw(MarkdownPanelWidget) },
    { name: "CitationPanelWidget", component: markRaw(CitationPanelWidget) },
  ],
  defaultLayout: dashboardLayout.value,
}));

const SOURCE_META = {
  discover: { key: "discover", label: "Public dataset", icon: IconGlobeCheck },
  view: { key: "view", label: "Shared view", icon: IconEyeball },
};
const sourceMeta = computed(
  () => SOURCE_META[props.dataset.sourceType] || SOURCE_META.discover
);

onMounted(loadReadme);
watch(() => props.dataset.id, loadReadme);

const contributorNames = computed(() =>
  (props.dataset.contributors || []).map((c) =>
    [c.firstName, c.middleInitial, c.lastName].filter(Boolean).join(" ")
  )
);

const formatNumber = (n) => (n || 0).toLocaleString();

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.header-row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-start;
}

.header-info {
  flex: 1 1 380px;
  min-width: 0;
}

.dataset-title {
  font-size: 32px;
  color: #000;
  font-weight: bold;
  line-height: 40px;
  margin: 0 0 12px 0;
  word-break: break-word;
}

.dataset-pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.pill-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}


.dataset-owners {
  display: flex;
  flex-wrap: wrap;
  color: #404554;
  font-size: 14px;
  line-height: 24px;
  margin-bottom: 13px;
}

.dataset-description {
  color: #000;
  font-size: 16px;
  line-height: 24px;
  margin: 0 0 24px 0;
}

.dataset-meta {
  color: #404554;
  font-size: 14px;
  line-height: 24px;

  a {
    color: #404554;
    text-decoration: underline;
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.tag {
  background: theme.$gray_1;
  color: theme.$gray_5;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.header-image-section {
  flex: 1 1 320px;
  max-width: 480px;

  .dataset-image {
    display: block;
    height: auto;
    width: 100%;
    border-radius: 4px;
  }
}

.header-stats-section {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  border-top: 1px solid #dadada;
  border-bottom: 1px solid #dadada;
  margin: 26px 0 10px;
  padding: 16px;
}

.header-stats-block {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #404554;
  min-width: 160px;

  strong {
    color: #000;
  }
}

.overview-dashboard {
  margin-top: 8px;
  min-height: 360px;
}
</style>
