<template>
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="references-panel-widget">
    <div v-if="items.length === 0" class="empty">No references.</div>
    <ul v-else class="reference-list">
      <li v-for="item in items" :key="item.doi" class="reference-item">
        <span v-if="item.relationshipType" class="rel-type">
          {{ humanizeRelationship(item.relationshipType) }}
        </span>
        <span v-if="item.loading" class="muted">Loading citation…</span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-else-if="item.citation" class="citation" v-html="item.citation" />
        <a
          v-else
          :href="`https://doi.org/${item.doi}`"
          target="_blank"
          rel="noopener"
        >{{ item.doi }}</a>

        <a
          v-if="item.citation"
          class="doi-link"
          :href="`https://doi.org/${item.doi}`"
          target="_blank"
          rel="noopener"
        >View</a>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import striptags from "striptags";

// Match the dashboard's widget contract (see MarkdownPanelWidget): with a
// fragment root, the WidgetWrapper's layout class/style must not auto-inherit.
defineOptions({ inheritAttrs: false });

const props = defineProps({
  publications: { type: Array, default: () => [] },
  widgetName: { type: String, default: "References" },
});

const items = ref([]);

const humanizeRelationship = (type) =>
  String(type).replace(/([a-z])([A-Z])/g, "$1 $2");

const loadCitations = async () => {
  items.value = props.publications.map((p) => ({
    doi: p.doi,
    relationshipType: p.relationshipType || "",
    citation: "",
    loading: true,
  }));

  await Promise.all(
    items.value.map(async (item) => {
      try {
        const response = await fetch(`https://doi.org/${item.doi}`, {
          headers: { Accept: "text/x-bibliography; style=apa" },
        });
        if (!response.ok) throw new Error(`DOI lookup failed: ${response.status}`);
        // Citations come back with <i>/<b> only — strip everything else.
        item.citation = striptags((await response.text()).trim(), ["i", "b"]);
      } catch (e) {
        console.warn("Could not resolve reference citation:", item.doi, e);
        item.citation = "";
      } finally {
        item.loading = false;
      }
    })
  );
};

onMounted(loadCitations);
</script>

<style scoped lang="scss">
@use '../../../../styles/_theme.scss';

.references-panel-widget {
  padding: 0 16px 12px;
}

.empty {
  color: theme.$gray_4;
  font-size: 14px;
}

.reference-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.reference-item {
  padding: 12px 0;
  border-bottom: 1px solid theme.$gray_1;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_6;

  &:last-child {
    border-bottom: none;
  }
}

.rel-type {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: theme.$purple_2;
  margin-right: 8px;
}

.citation {
  color: theme.$gray_6;
}

.doi-link {
  margin-left: 8px;
  color: theme.$purple_2;
  white-space: nowrap;
}

.muted {
  color: theme.$gray_4;
}
</style>
