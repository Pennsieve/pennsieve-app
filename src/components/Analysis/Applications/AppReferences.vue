<script setup>
/*
  An App Store version's references: how to cite the app, its authors, and
  the works it relates to, from the repository's CITATION.cff (read by
  app-deploy-service at release). The page shows this only when a version
  has a citation.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import DOMPurify from "dompurify";
import { ElMessage } from "element-plus";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import {
  bareDoi,
  citationVersion,
  doiUrl,
  groupRelatedWorks,
  orcidUrl,
  softwareCitationText,
  workCitationText,
  workLink,
} from "./citation";

const props = defineProps({
  // The app's versions, newest first.
  versions: { type: Array, default: () => [] },
});

const store = useStore();

const withCitation = computed(() => props.versions.filter((v) => v?.citation));
const selectedUuid = ref("");
const version = computed(() => citationVersion(props.versions, selectedUuid.value));
const citation = computed(() => version.value?.citation || null);
const preferred = computed(() => citation.value?.preferredCitation || null);
const authors = computed(() => citation.value?.authors || []);
const groups = computed(() => groupRelatedWorks(citation.value));
const softwareText = computed(() => softwareCitationText(citation.value, version.value?.version));

/*
  Formatted citations from the DOI lookup the dataset references use
  (GET /datasets/external-publications/citation?doi=), one request per DOI;
  until it answers, or when it can't, the work is shown from CITATION.cff.
*/
const formatted = ref({});
const lookups = new Map();
const lookup = (doi) => {
  const key = bareDoi(doi).toLowerCase();
  if (!key || lookups.has(key)) return;
  const apiUrl = store.state.config?.apiUrl;
  if (!apiUrl) return;
  lookups.set(key, true);
  useGetToken()
    .then((token) =>
      useSendXhr(
        `${apiUrl}/datasets/external-publications/citation?doi=${encodeURIComponent(key)}&api_key=${token}`
      )
    )
    .then((resp) => {
      const html = DOMPurify.sanitize(String(resp?.citation || ""), { ALLOWED_TAGS: ["i", "b"] }).trim();
      if (html) formatted.value = { ...formatted.value, [key]: html };
    })
    .catch(() => {});
};
watch(
  citation,
  (c) => {
    if (!c) return;
    if (c.preferredCitation) lookup(c.preferredCitation.doi);
    for (const w of c.relatedWorks || []) lookup(w.doi);
  },
  { immediate: true }
);
const formattedFor = (work) => formatted.value[bareDoi(work?.doi).toLowerCase()] || "";

// How to cite: the preferred citation, else the software itself.
const howToCite = computed(() => {
  if (preferred.value) {
    const html = formattedFor(preferred.value);
    return { html, text: workCitationText(preferred.value), link: workLink(preferred.value) };
  }
  return { html: "", text: softwareText.value, link: doiUrl(citation.value?.doi) };
});

const plainText = (html) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || "").trim();
};
// The link to show after a citation, unless the citation already has it.
const trailingLink = (text, link) => {
  if (!link) return "";
  const doi = link.replace(/^https:\/\/doi\.org\//, "").toLowerCase();
  return String(text || "").toLowerCase().includes(doi) ? "" : link;
};
// A related work: its formatted citation (or CITATION.cff text) and link.
const workView = (work) => {
  const html = formattedFor(work);
  const link = workLink(work);
  const text = html ? "" : workCitationText(work).replace(link, "").trim();
  return { html, text, link: html ? trailingLink(plainText(html), link) : link };
};
const citeLink = computed(() => {
  const c = howToCite.value;
  return trailingLink(c.html ? plainText(c.html) : c.text, c.link);
});
const copyCitation = async () => {
  const c = howToCite.value;
  const text = [c.html ? plainText(c.html) : c.text, citeLink.value].filter(Boolean).join(" ");
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("Citation copied");
  } catch {
    ElMessage.error("Couldn't copy; select the text instead");
  }
};
</script>

<template>
  <div v-if="citation" class="references">
    <!-- Which version: only when more than one has a CITATION.cff -->
    <div v-if="withCitation.length > 1" class="references-version">
      <span class="references-label">Version</span>
      <el-select
        :model-value="version?.uuid"
        size="small"
        class="references-version-select"
        @update:model-value="selectedUuid = $event"
      >
        <el-option v-for="v in withCitation" :key="v.uuid" :label="v.version" :value="v.uuid" />
      </el-select>
    </div>

    <!-- How to cite -->
    <section class="references-block">
      <div class="references-block-head">
        <h4 class="references-title">How to cite</h4>
        <button type="button" class="references-copy" @click="copyCitation">Copy citation</button>
      </div>
      <div class="references-cite">
        <!-- eslint-disable-next-line vue/no-v-html -- sanitized to <i>/<b> -->
        <span v-if="howToCite.html" v-html="howToCite.html" />
        <span v-else>{{ howToCite.text }}</span>
        <a
          v-if="citeLink"
          :href="citeLink"
          target="_blank"
          rel="noopener noreferrer"
          class="references-link"
        >
          {{ citeLink }}
        </a>
      </div>
      <!-- Cite the software too when a paper is preferred and it has a DOI -->
      <p v-if="preferred && citation.doi" class="references-note">
        This version of the software:
        {{ softwareText }}
      </p>
      <p v-else-if="!preferred" class="references-note">
        From the repository's CITATION.cff.
      </p>
    </section>

    <!-- Authors -->
    <section v-if="authors.length" class="references-block">
      <h4 class="references-title">Authors</h4>
      <ul class="references-authors">
        <li v-for="(a, i) in authors" :key="`${a.name}-${i}`" class="references-author">
          <span class="references-author-name">{{ a.name }}</span>
          <span v-if="a.affiliation" class="references-muted">{{ a.affiliation }}</span>
          <a
            v-if="a.orcid"
            :href="orcidUrl(a.orcid)"
            target="_blank"
            rel="noopener noreferrer"
            class="references-link"
          >
            ORCID {{ a.orcid }}
          </a>
        </li>
      </ul>
    </section>

    <!-- Related works, by relation type -->
    <section v-for="g in groups" :key="g.type" class="references-block">
      <h4 class="references-title">{{ g.label }}</h4>
      <ul class="references-works">
        <li
          v-for="(w, i) in g.works"
          :key="`${w.doi || w.url || w.title}-${i}`"
          class="references-work"
        >
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized to <i>/<b> -->
          <span v-if="workView(w).html" v-html="workView(w).html" />
          <span v-else>{{ workView(w).text }}</span>
          <a
            v-if="workView(w).link"
            :href="workView(w).link"
            target="_blank"
            rel="noopener noreferrer"
            class="references-link"
          >
            {{ workView(w).link }}
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.references {
  padding: 16px;
  overflow-y: auto;
}

.references-version {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.references-version-select {
  width: 140px;
}

.references-label {
  font-size: 12px;
  color: theme.$gray_5;
}

.references-block {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.references-block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.references-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$black;
}

.references-copy {
  padding: 2px 8px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}

.references-cite {
  padding: 10px 12px;
  border-left: 3px solid theme.$purple_1;
  background: theme.$gray_1;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$black;
  word-break: break-word;

  .references-link {
    margin-left: 4px;
  }
}

.references-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: theme.$gray_5;
  word-break: break-word;
}

.references-authors,
.references-works {
  margin: 0;
  padding: 0;
  list-style: none;
}

.references-author {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
}

.references-author-name {
  color: theme.$black;
}

.references-muted {
  font-size: 12px;
  color: theme.$gray_5;
}

.references-work {
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$black;
  word-break: break-word;

  & + & {
    border-top: 1px solid theme.$gray_2;
  }

  .references-link {
    margin-left: 4px;
  }
}

.references-link {
  font-size: 12px;
  color: theme.$purple_3;
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
}
</style>
