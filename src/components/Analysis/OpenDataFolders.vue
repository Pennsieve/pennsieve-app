<script setup>
// An Open Data dataset's bucket, one level at a time (views-service lists
// it): the folder shown is the one chosen (prefix; ends in /), and a view of
// it takes everything below. root is the folder the user can't go above
// (an OpenNeuro dataset's ds folder; "" for the whole resource). The filter
// narrows a level by its names' first letters, which S3 does, so it finds a
// folder past the first 1,000. list, when given, lists a level instead (a
// dandiset version's tree, from DANDI's API), as listOpenDataFolder does;
// a file it marks zarr is a Zarr folder, which a notebook reads in place.
import { computed, onMounted, ref, watch } from "vue";
import { listOpenDataFolder } from "@/utils/viewsService";

const props = defineProps({
  // The dataset's registry name.
  dataset: { type: String, required: true },
  root: { type: String, default: "" },
  // The breadcrumb's first part, for root.
  rootLabel: { type: String, required: true },
  // ({ prefix, startsWith }) => a level, instead of the bucket's.
  list: { type: Function, default: null },
  // Whether the filter finds names past the first 1,000 (S3 filters by
  // name; DANDI doesn't).
  filterFindsMore: { type: Boolean, default: true },
});
const prefix = defineModel("prefix", { type: String, default: "" });

const level = ref(null); // { folders, files, truncated }
const loading = ref(false);
const error = ref("");
const filter = ref("");
let seq = 0;
let filterTimer = null;

async function load() {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const args = { dataset: props.dataset, prefix: prefix.value, startsWith: filter.value.trim() };
    const l = await (props.list ? props.list(args) : listOpenDataFolder(args));
    if (mine === seq) level.value = l;
  } catch (err) {
    console.error("Failed to list the Open Data folder:", err);
    if (mine === seq) {
      level.value = null;
      error.value = err?.message || "The folder couldn't be listed.";
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}

watch([() => props.dataset, prefix], () => {
  filter.value = "";
  load();
});
onMounted(load);

const onFilter = () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(load, 300);
};

// The path below root to the folder shown, for going back up.
const crumbs = computed(() => {
  const parts = prefix.value.slice(props.root.length).split("/").filter(Boolean);
  return parts.map((name, i) => ({ name, prefix: props.root + parts.slice(0, i + 1).join("/") + "/" }));
});
const levelFiles = computed(() => (level.value?.files || []).filter((f) => !f.zarr));
const levelZarrs = computed(() => (level.value?.files || []).filter((f) => f.zarr));
const levelSize = computed(() => levelFiles.value.reduce((n, f) => n + (f.size || 0), 0));
const shown = computed(() => (prefix.value === props.root ? "" : prefix.value.slice(props.root.length)));

const formatSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
</script>

<template>
  <div class="odf">
    <div class="odf__bar">
      <nav class="odf-crumbs" aria-label="Folder">
        <button type="button" class="odf-crumb" :class="{ 'is-current': !crumbs.length }" @click="prefix = root">
          {{ rootLabel }}
        </button>
        <template v-for="(c, i) in crumbs" :key="c.prefix">
          <span class="odf-crumbs__sep">/</span>
          <button
            type="button"
            class="odf-crumb"
            :class="{ 'is-current': i === crumbs.length - 1 }"
            @click="prefix = c.prefix"
          >
            {{ c.name }}
          </button>
        </template>
      </nav>
      <el-input
        v-model="filter"
        class="odf__filter"
        size="small"
        placeholder="Filter by first letters"
        clearable
        @input="onFilter"
      />
    </div>
    <p class="odf__note">
      The notebook starts with {{ shown ? `everything in ${shown}` : `all of ${rootLabel}` }}.
      Open a folder to start with less; a notebook lists at most 100,000 files.
    </p>
    <div class="odf__level">
      <div v-if="loading" class="odf__msg">Listing…</div>
      <div v-else-if="error" class="odf__msg">{{ error }}</div>
      <template v-else-if="level">
        <button
          v-for="f in level.folders"
          :key="f"
          type="button"
          class="odf-row"
          :title="`Open ${f}/`"
          @click="prefix = `${prefix}${f}/`"
        >
          <span>{{ f }}/</span>
          <svg class="odf-row__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div v-if="levelFiles.length" class="odf__msg">
          {{ levelFiles.length }} file{{ levelFiles.length === 1 ? "" : "s" }} here · {{ formatSize(levelSize) }}
        </div>
        <div v-if="levelZarrs.length" class="odf__msg" :title="levelZarrs.map((f) => f.name).join('\n')">
          {{ levelZarrs.length }} Zarr folder{{ levelZarrs.length === 1 ? "" : "s" }} here ({{ formatSize(levelZarrs.reduce((n, f) => n + f.size, 0)) }}): read in place from the notebook, not downloaded
        </div>
        <div v-if="!level.folders.length && !level.files.length" class="odf__msg">
          Nothing here{{ filter ? ` starting with "${filter}"` : "" }}
        </div>
        <div v-if="level.truncated" class="odf__msg">
          Showing the first 1,000.<template v-if="filterFindsMore"> Type the first letters of a name to find others.</template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.odf__bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.odf-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  font-size: 13px;
}
.odf-crumbs__sep {
  color: theme.$gray_3;
}
.odf-crumb {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: theme.$purple_2;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
  &.is-current {
    color: theme.$gray_6;
    font-weight: 600;
    cursor: default;
    text-decoration: none;
  }
}
.odf__filter {
  width: 200px;
  flex-shrink: 0;
}
.odf__note {
  margin: 6px 0 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
.odf__level {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
}
.odf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-bottom: 1px solid theme.$gray_2;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  &:hover .odf-row__chevron {
    color: theme.$gray_5;
  }
}
.odf-row__chevron {
  flex-shrink: 0;
  color: theme.$gray_3;
}
.odf__msg {
  padding: 8px 12px;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
