<template>
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="citation-panel-widget">
    <div v-if="unavailable" class="info-citation info-citation--muted">
      A citation is not available for this dataset
      <template v-if="doi">
        — view it on
        <a :href="`https://crosscite.org/?doi=${doi}`" target="_blank" rel="noopener">Crosscite.org</a>.
      </template>
    </div>

    <template v-else>
      <div v-if="error" class="info-citation">
        <p class="mb-0">
          Sorry, an error occurred.
          <a href="#" @click.prevent="fetchCitation">Try again</a>
        </p>
      </div>
      <div v-else v-loading="loading" class="info-citation" aria-live="polite">
        {{ citationText }}
      </div>

      <div class="info-citation-links">
        Formatted as:
        <button :class="{ active: type === 'apa' }" @click="setType('apa')">APA</button>
        |
        <button :class="{ active: type === 'chicago-note-bibliography' }" @click="setType('chicago-note-bibliography')">Chicago</button>
        |
        <button :class="{ active: type === 'ieee' }" @click="setType('ieee')">IEEE</button>
        |
        <a :href="`https://crosscite.org/?doi=${doi}`" target="_blank" rel="noopener">More on Crosscite.org</a>
        <button class="copy-btn" :disabled="!citationText" @click="copy">
          {{ copied ? "Copied" : "Copy" }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";

// Match the dashboard's widget contract (see MarkdownPanelWidget): the
// WidgetWrapper passes layout class/style; with a fragment root they must not
// auto-inherit onto our root (it breaks grid sizing + warns).
defineOptions({ inheritAttrs: false });

const props = defineProps({
  doi: { type: String, default: "" },
  // Lib-injected props (from the dashboard).
  widgetName: { type: String, default: "Citation" },
});

const type = ref("apa");
const citationText = ref("");
const loading = ref(false);
const error = ref(false);
const unavailable = ref(false);
const copied = ref(false);

const fetchCitation = async () => {
  if (!props.doi) {
    unavailable.value = true;
    return;
  }
  loading.value = true;
  error.value = false;
  unavailable.value = false;
  try {
    const url = `https://citation.doi.org/format?doi=${encodeURIComponent(props.doi)}&style=${type.value}&lang=en-US`;
    const response = await fetch(url);
    if (response.status === 404) {
      // DOI not registered with the resolver (common on dev) — not an error.
      unavailable.value = true;
      return;
    }
    if (!response.ok) throw new Error(`Citation request failed: ${response.status}`);
    citationText.value = (await response.text()).trim();
  } catch (e) {
    console.error("Error loading citation:", e);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

const setType = (t) => {
  type.value = t;
};

const copy = async () => {
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
watch(type, fetchCitation);
watch(() => props.doi, fetchCitation);
</script>

<style scoped lang="scss">
@use '../../../../styles/_theme.scss';

.citation-panel-widget {
  padding: 0 16px 12px;
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

  &--muted {
    background-color: theme.$gray_1;
    color: theme.$gray_5;

    a {
      color: theme.$purple_2;
    }
  }
}

.info-citation-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
  color: theme.$gray_4;

  button,
  a {
    color: theme.$purple_2;
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
