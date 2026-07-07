<template>
  <div class="public-dataset-overview">
    <!-- Dataset-level actions (top-right; grows with Download / pipeline) -->
    <div v-if="dataset.doi" class="overview-actions">
      <el-button @click="showAddToCollection = true">
        <IconCollection class="mr-8" :width="16" :height="16" color="currentColor" />
        Add to Collection
      </el-button>
    </div>

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

          <el-dropdown
            v-if="hasMultipleVersions"
            trigger="click"
            @command="onSelectVersion"
          >
            <bf-pill class="version-pill">
              Version {{ dataset.version }} <span class="caret">▾</span>
            </bf-pill>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="v in store.versions"
                  :key="v.version"
                  :command="v.version"
                  :class="{ 'is-active': v.version === dataset.version }"
                >
                  Version {{ v.version }}
                  <span v-if="v.versionPublishedAt" class="version-date">
                    · {{ formatDate(v.versionPublishedAt) }}
                  </span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <bf-pill v-else-if="dataset.version">Version {{ dataset.version }}<template v-if="dataset.revision">, Rev. {{ dataset.revision }}</template></bf-pill>
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

    <!-- README + Citation side by side; References full width below. -->
    <div class="overview-body">
      <div v-if="readmeContent || dataset.doi" class="overview-row">
        <section v-if="readmeContent" class="overview-card overview-card--readme">
          <h3 class="overview-card-title">README</h3>
          <markdown-panel-widget :value="readmeContent" :locked="true" />
        </section>
        <section v-if="dataset.doi" class="overview-card overview-card--citation">
          <h3 class="overview-card-title">Citation</h3>
          <citation-panel-widget :doi="dataset.doi" />
        </section>
      </div>

      <section v-if="hasReferences" class="overview-card">
        <h3 class="overview-card-title">References</h3>
        <references-panel-widget :publications="dataset.externalPublications" />
      </section>
    </div>

    <add-to-collection-dialog
      v-model:visible="showAddToCollection"
      :doi="dataset.doi"
      :dataset-name="dataset.name"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import IconFiles from "@/components/icons/IconFiles.vue";
import IconStorage from "@/components/icons/IconStorage.vue";
import IconDocument from "@/components/icons/IconDocument.vue";
import IconLicense from "@/components/icons/IconLicense.vue";
import IconGlobeCheck from "@/components/icons/IconGlobeCheck.vue";
import IconEyeball from "@/components/icons/IconEyeball.vue";
import BfPill from "@/components/shared/BfPill/BfPill.vue";
import IconCollection from "@/components/icons/IconCollection.vue";
import MarkdownPanelWidget from "@/components/datasets/DatasetOverview/widgets/MarkdownPanelWidget.vue";
import CitationPanelWidget from "./widgets/CitationPanelWidget.vue";
import ReferencesPanelWidget from "./widgets/ReferencesPanelWidget.vue";
import AddToCollectionDialog from "./AddToCollectionDialog.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const store = useReadOnlyDatasetStore();
const route = useRoute();
const router = useRouter();

const showAddToCollection = ref(false);

// ---- Version selection ----
const hasMultipleVersions = computed(() => store.versions.length > 1);
const latestVersion = computed(() =>
  store.versions.length ? Math.max(...store.versions.map((v) => v.version)) : null
);

const onSelectVersion = (version) => {
  if (version === props.dataset.version) return;
  const query = { ...route.query };
  // Keep the URL clean when selecting the latest version.
  if (version === latestVersion.value) {
    delete query.version;
  } else {
    query.version = version;
  }
  router.push({ name: route.name, params: route.params, query });
};

// ---- README (read-only markdown) ----
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

const hasReferences = computed(
  () => (props.dataset.externalPublications || []).length > 0
);

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

.overview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.pill-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.version-pill {
  cursor: pointer;

  .caret {
    margin-left: 4px;
    font-size: 10px;
    color: theme.$gray_5;
  }
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

.overview-body {
  margin-top: 24px;
}

.overview-row {
  display: flex;
  gap: 48px;
  align-items: flex-start;
  margin-bottom: 40px;

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 32px;
  }
}

.overview-card {
  margin-bottom: 40px;

  &:last-child {
    margin-bottom: 0;
  }

  &--readme {
    flex: 2 1 0;
    min-width: 0;
    margin-bottom: 0;
  }

  &--citation {
    flex: 1 1 0;
    min-width: 0;
    margin-bottom: 0;
  }
}

// Lightweight section label — no box, just a quiet eyebrow above the content.
.overview-card-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: theme.$gray_4;
  margin: 0 0 12px 0;
}

// The widgets ship their own internal padding for the dashboard chrome —
// strip it so content sits flush under its section label.
.overview-card :deep(.markdown-panel-widget),
.overview-card :deep(.citation-panel-widget),
.overview-card :deep(.references-panel-widget) {
  padding: 0;
}

// MarkdownEditor's content area is padded for the editor chrome; in this
// read-only preview, strip it so the README text aligns with the label.
.overview-card--readme :deep(.content-wrap) {
  padding: 0;
}
</style>
