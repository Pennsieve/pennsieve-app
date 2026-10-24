<script setup>
// The builder's palette, on the left: input data and output, and the apps,
// each by what its app.yml says it does and takes (appManifestInfo.js).
// Searchable by name, description, tag and media type; with a step
// selected, the apps that accept its output come first. Click adds after
// the selected step; drag places. Apps without an app.yml are listed as
// usual, marked; their owner gets a link to the manifest builder.
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { appColor, appInitials } from "../Applications/appCards";
import { ioLine, manifestsServed, matchesApp, paletteGroups, versionManifest } from "./appManifestInfo";

const props = defineProps({
  applications: { type: Array, default: () => [] },
  // (app) -> its name
  appName: { type: Function, required: true },
  // The selected step's declared ports, or null: what "fits after" means.
  stepPorts: { type: Object, default: null },
  stepLabel: { type: String, default: "" },
  loading: { type: Boolean, default: false },
});
// add(type, app), dragstart(app, event, type)
const emit = defineEmits(["add", "dragstart"]);

const store = useStore();
const route = useRoute();
const me = computed(() => store.state.profile?.id || "");
const query = ref("");

const served = computed(() => manifestsServed(props.applications));
const shown = computed(() => props.applications.filter((a) => matchesApp(a, query.value, props.appName)));
const groups = computed(() =>
  paletteGroups(shown.value, { stepPorts: props.stepPorts, me: me.value, name: props.appName })
);
const manifestOf = (app) => versionManifest(app);
const description = (app) => manifestOf(app)?.description || app.description || "";
const lacksManifest = (app) => served.value && !manifestOf(app);
const manifestBuilder = computed(() => ({
  name: route.params.orgId ? "application-manifest-builder" : "my-application-manifest-builder",
}));
// The tile's colours and letters, as in the Gallery, from the app's name.
const tileOf = (app) => ({ name: props.appName(app) });
</script>

<template>
  <aside class="pal" aria-label="Steps to add">
    <el-input v-model="query" size="small" clearable placeholder="Search apps, tags, file types…" class="pal-search" />

    <div class="pal-section">
      <div class="pal-heading">Data</div>
      <button
        type="button"
        class="pal-item pal-item--data"
        draggable="true"
        title="Click to add, or drag onto the canvas"
        @click="emit('add', 'data-source', null)"
        @dragstart="emit('dragstart', null, $event, 'data-source')"
      >
        <span class="pal-kind pal-kind--source" aria-hidden="true" />
        <span class="pal-text">
          <span class="pal-name">Input data</span>
          <span class="pal-line">Files the workflow starts from</span>
        </span>
      </button>
      <button
        type="button"
        class="pal-item pal-item--data"
        draggable="true"
        title="Click to add, or drag onto the canvas"
        @click="emit('add', 'data-target', null)"
        @dragstart="emit('dragstart', null, $event, 'data-target')"
      >
        <span class="pal-kind pal-kind--target" aria-hidden="true" />
        <span class="pal-text">
          <span class="pal-name">Output</span>
          <span class="pal-line">Where the results go</span>
        </span>
      </button>
    </div>

    <p v-if="loading" class="pal-empty">Loading apps…</p>
    <template v-else>
      <div v-for="g in groups" :key="g.key" class="pal-section">
        <div class="pal-heading">
          {{ g.key === "fits" && stepLabel ? `Fits after ${stepLabel}` : g.label }}
        </div>
        <p v-if="!g.apps.length" class="pal-empty">
          No app declares that it takes this step's output.
        </p>
        <button
          v-for="app in g.apps"
          :key="app.uuid || app.sourceUrl"
          type="button"
          class="pal-item"
          draggable="true"
          :title="description(app) || appName(app)"
          @click="emit('add', 'default', app)"
          @dragstart="emit('dragstart', app, $event, 'application')"
        >
          <span class="pal-tile" :style="appColor(tileOf(app))" aria-hidden="true">{{ appInitials(tileOf(app)) }}</span>
          <span class="pal-text">
            <span class="pal-name">{{ appName(app) }}</span>
            <span v-if="ioLine(manifestOf(app))" class="pal-io">{{ ioLine(manifestOf(app)) }}</span>
            <span v-if="description(app)" class="pal-line">{{ description(app) }}</span>
            <span v-if="(manifestOf(app)?.tags || []).length" class="pal-tags">
              <span v-for="t in manifestOf(app).tags.slice(0, 3)" :key="t" class="pal-tag">{{ t }}</span>
            </span>
            <span v-if="lacksManifest(app)" class="pal-nomanifest">
              No manifest
              <router-link v-if="app.ownerId === me" :to="manifestBuilder" class="pal-link" @click.stop>
                Add an app.yml
              </router-link>
            </span>
          </span>
        </button>
      </div>
      <p v-if="!shown.length" class="pal-empty">No app matches "{{ query }}".</p>
    </template>
  </aside>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.pal {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 260px;
  flex-shrink: 0;
  padding: 12px 10px;
  overflow-y: auto;
  border-right: 1px solid theme.$gray_2;
  background: theme.$white;
}
.pal-search {
  margin-bottom: 6px;
}
.pal-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.pal-heading {
  padding: 4px 4px 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.pal-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    border-color: theme.$gray_2;
    background: theme.$gray_1;
    outline: none;
  }
  &:active {
    cursor: grabbing;
  }
}
.pal-kind {
  width: 4px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 2px;
}
.pal-kind--source {
  background: #6366f1;
}
.pal-kind--target {
  background: #64748b;
}
.pal-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  font-size: 11px;
  font-weight: 600;
}
.pal-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.pal-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}
.pal-io {
  font-size: 11px;
  font-weight: 500;
  color: #9a5c0f;
}
.pal-line {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 11px;
  line-height: 1.35;
  color: theme.$gray_4;
}
.pal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}
.pal-tag {
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 10px;
  color: theme.$gray_5;
}
.pal-nomanifest {
  font-size: 11px;
  color: theme.$gray_4;
  font-style: italic;
}
.pal-link {
  margin-left: 4px;
  font-style: normal;
  color: theme.$link-color;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.pal-empty {
  margin: 2px 4px 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
