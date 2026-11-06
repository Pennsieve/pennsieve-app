<script setup>
// The chosen data platform's picker, under its name and what it gives the
// notebook: the right column beside PlatformList, in the new notebook
// dialog and a running session's "Add data". Each picker is bound to its
// part of the selection (platformSelection), so moving between platforms
// keeps what was chosen on each.
import { computed } from "vue";
import PlatformMark from "./PlatformMark.vue";
import DiscoverPicker from "./DiscoverPicker.vue";
import OpenDataPicker from "./OpenDataPicker.vue";
import OpenNeuroPicker from "./OpenNeuroPicker.vue";
import PortalPicker from "./PortalPicker.vue";
import DandiPicker from "./DandiPicker.vue";
import BossdbPicker from "./BossdbPicker.vue";
import PhysionetPicker from "./PhysionetPicker.vue";
import { DATA_PLATFORMS } from "./dataPlatforms";
import { OPEN_DATA_PORTALS } from "@/utils/openDataPortals";

const props = defineProps({
  platform: { type: String, required: true },
  // platformSelection's newSelection().
  selection: { type: Object, required: true },
});

const isPortal = computed(() => props.platform in OPEN_DATA_PORTALS);
const TITLES = {
  discover: "Choose a Pennsieve Discover dataset",
  openData: "Choose an AWS Open Data dataset",
  openNeuro: "Choose an OpenNeuro dataset",
  dandi: "Choose a dandiset",
  bossdb: "Choose BossDB data",
  physionet: "Choose a PhysioNet project",
};
const title = computed(() => TITLES[props.platform] || `Choose a ${DATA_PLATFORMS[props.platform]?.name} dataset`);
</script>

<template>
  <div class="pp">
    <h4 class="pp__title">
      <PlatformMark :platform="platform" :size="24" />
      {{ title }}
    </h4>

    <template v-if="platform === 'discover'">
      <p class="pp__desc">
        A published dataset and its version. The notebook gets its file list; you pick which files
        to download.
      </p>
      <DiscoverPicker v-model:dataset="selection.discover.dataset" v-model:version="selection.discover.version" />
    </template>

    <template v-else-if="platform === 'openNeuro'">
      <p class="pp__desc">
        A dataset from <a href="https://openneuro.org" target="_blank" rel="noopener">OpenNeuro</a>,
        read from its copy in the Registry of Open Data on AWS at its latest version. The notebook
        gets its file list; you pick which files to download.
      </p>
      <OpenNeuroPicker v-model:dataset="selection.openNeuro.dataset" v-model:prefix="selection.openNeuro.prefix" />
    </template>

    <template v-else-if="platform === 'bossdb'">
      <p class="pp__desc">
        Volumes from <a href="https://bossdb.org" target="_blank" rel="noopener">BossDB</a>, read from
        its copy in the Registry of Open Data on AWS: whole collections, experiments or channels, as
        many as you need. The notebook reads each volume in place, a region at a time; nothing is
        downloaded up front.
      </p>
      <BossdbPicker v-model:picks="selection.bossdb.picks" />
    </template>

    <template v-else-if="platform === 'dandi'">
      <p class="pp__desc">
        A dandiset from the <a href="https://dandiarchive.org" target="_blank" rel="noopener">DANDI Archive</a>
        at a published version (or its draft), read from its copy in the Registry of Open Data on AWS.
        The notebook gets its file list; you pick which files to download.
      </p>
      <DandiPicker v-model:dataset="selection.dandi.dataset" v-model:prefix="selection.dandi.prefix" />
    </template>

    <template v-else-if="platform === 'physionet'">
      <p class="pp__desc">
        An open-access project from <a href="https://physionet.org" target="_blank" rel="noopener">PhysioNet</a>
        at a published version, read from its copy in the Registry of Open Data on AWS. The notebook
        gets its file list; you pick which files to download.
      </p>
      <PhysionetPicker v-model:dataset="selection.physionet.dataset" v-model:prefix="selection.physionet.prefix" />
    </template>

    <template v-else-if="isPortal">
      <p class="pp__desc">
        A dataset published on
        <a :href="OPEN_DATA_PORTALS[platform].url" target="_blank" rel="noopener">{{ DATA_PLATFORMS[platform].name }}</a>,
        read from its copy in the Registry of Open Data on AWS at its latest version. The notebook
        gets its file list; you pick which files to download.
      </p>
      <PortalPicker
        :key="platform"
        :portal="platform"
        v-model:dataset="selection[platform].dataset"
        v-model:prefix="selection[platform].prefix"
      />
    </template>

    <template v-else-if="platform === 'openData'">
      <p class="pp__desc">
        A dataset from the
        <a href="https://registry.opendata.aws/" target="_blank" rel="noopener">Registry of Open Data on AWS</a>,
        and the folder of it to take. The notebook gets its file list; you pick which files to download.
      </p>
      <OpenDataPicker v-model:dataset="selection.openData.dataset" v-model:prefix="selection.openData.prefix" />
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pp {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
/* A picker fills the column, and its list of results the rest of it: the
   dialog sets the height, the list scrolls inside. */
.discover-picker,
.on-picker,
.open-data-picker,
.pp-picker,
.dd-picker,
.bd-picker,
.pn-picker {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.discover-picker > :deep(.wizard-cards),
:deep(.on-cards),
:deep(.od-cards),
:deep(.pp-cards),
:deep(.dd-cards),
:deep(.bd-cards),
:deep(.pn-cards) {
  flex: 1 1 auto;
  min-height: 160px;
  max-height: none;
}
.pp__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pp__desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;

  a {
    color: theme.$purple_2;
  }
}
</style>
