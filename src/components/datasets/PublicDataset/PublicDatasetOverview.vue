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

    <!-- Citation -->
    <div v-if="dataset.doi" class="citation-section">
      <h3>Cite this dataset</h3>

      <div v-if="citationError" class="info-citation">
        <p class="mb-0">
          Sorry, an error has occurred.
          <a href="#" @click.prevent="fetchCitation">Try again</a>
        </p>
      </div>
      <div
        v-else
        v-loading="citationLoading"
        class="info-citation"
        aria-live="polite"
      >
        {{ citationText }}
      </div>

      <div class="info-citation-links">
        Formatted as:
        <button
          :class="{ active: citationType === 'apa' }"
          @click="citationType = 'apa'"
        >APA</button>
        |
        <button
          :class="{ active: citationType === 'chicago-note-bibliography' }"
          @click="citationType = 'chicago-note-bibliography'"
        >Chicago</button>
        |
        <button
          :class="{ active: citationType === 'ieee' }"
          @click="citationType = 'ieee'"
        >IEEE</button>
        |
        <a :href="`https://crosscite.org/?doi=${dataset.doi}`" target="_blank" rel="noopener">
          More on Crosscite.org
        </a>
        <button class="copy-btn" :disabled="!citationText" @click="copyCitation">
          {{ copied ? "Copied" : "Copy" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import IconFiles from "@/components/icons/IconFiles.vue";
import IconStorage from "@/components/icons/IconStorage.vue";
import IconDocument from "@/components/icons/IconDocument.vue";
import IconLicense from "@/components/icons/IconLicense.vue";
import IconGlobeCheck from "@/components/icons/IconGlobeCheck.vue";
import IconEyeball from "@/components/icons/IconEyeball.vue";
import BfPill from "@/components/shared/BfPill/BfPill.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const SOURCE_META = {
  discover: { key: "discover", label: "Public dataset", icon: IconGlobeCheck },
  view: { key: "view", label: "Shared view", icon: IconEyeball },
};
const sourceMeta = computed(
  () => SOURCE_META[props.dataset.sourceType] || SOURCE_META.discover
);

// ---- Citation (matches pennsieve-discover citation block) ----
const citationType = ref("apa");
const citationText = ref("");
const citationLoading = ref(false);
const citationError = ref(false);
const copied = ref(false);

const fetchCitation = async () => {
  const doi = props.dataset.doi;
  if (!doi) return;
  citationLoading.value = true;
  citationError.value = false;
  try {
    const url = `https://citation.doi.org/format?doi=${encodeURIComponent(doi)}&style=${citationType.value}&lang=en-US`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Citation request failed: ${response.status}`);
    citationText.value = (await response.text()).trim();
  } catch (e) {
    console.error("Error loading citation:", e);
    citationError.value = true;
    citationText.value = "";
  } finally {
    citationLoading.value = false;
  }
};

const copyCitation = async () => {
  if (!citationText.value) return;
  try {
    await navigator.clipboard.writeText(citationText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    console.error("Error copying citation:", e);
  }
};

onMounted(fetchCitation);
watch(citationType, fetchCitation);
watch(() => props.dataset.doi, fetchCitation);

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

.citation-section {
  margin-top: 24px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }
}

.info-citation {
  border-radius: 4px;
  background-color: #cddaff;
  padding: 16px;
  color: #011f5b;
  font-size: 14px;
  line-height: 24px;
  margin-bottom: 8px;
  min-height: 24px;

  a {
    color: #011f5b;
    text-decoration: underline;
  }
}

.info-citation-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
  line-height: 16px;
  color: theme.$gray_4;

  button,
  a {
    color: theme.$purple_2;
    line-height: 16px;
    text-decoration: underline;
    font-size: 14px;
    cursor: pointer;

    &.active {
      text-decoration: none;
      font-weight: 600;
      color: theme.$gray_6;
    }

    &:disabled {
      color: theme.$gray_3;
      cursor: default;
      text-decoration: none;
    }
  }

  .copy-btn {
    margin-left: auto;
    text-decoration: none;
    border: 1px solid theme.$gray_2;
    border-radius: 4px;
    padding: 4px 12px;
  }
}
</style>
