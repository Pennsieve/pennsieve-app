<!--
  Compact upload status pill. Per-row placeholder progress in the
  DatasetFiles table (see uploadModule getPlaceholdersForFolder) is the
  primary feedback; this pill exists only to give an aggregate for large
  batches and keep the upload visible when the user has navigated away
  from the destination folder. Clicking the pill jumps back to the
  destination.
-->
<template>
  <transition name="pill-fade">
    <div
      v-if="hasActivity"
      class="upload-pill"
      :class="pillVariantClass"
      role="status"
      @click="jumpToDestination"
    >
      <bf-waiting-icon v-if="!allDone" class="pill-icon" />
      <span class="pill-label">{{ pillLabel }}</span>
      <button
        class="pill-dismiss"
        :title="allDone ? 'Dismiss' : 'Cancel'"
        @click.stop="onDismiss"
      >
        <icon-remove :height="14" :width="14" />
      </button>
    </div>
  </transition>
</template>

<script>
import { mapGetters } from "vuex";
import BfWaitingIcon from "../../../shared/bf-waiting-icon/bf-waiting-icon.vue";
import IconRemove from "../../../icons/IconRemove.vue";

export default {
  name: "BfUploadInfo",

  components: {
    BfWaitingIcon,
    IconRemove,
  },

  computed: {
    ...mapGetters("uploadModule", [
      "getUploadMap",
      "getIsUploading",
      "getUploadComplete",
      "getTotalFilesInBatch",
      "getUploadDestination",
      "getManifestFiles",
    ]),

    hasActivity() {
      const mapSize = this.getUploadMap().size;
      const manifestSize = this.getManifestFiles().length;
      return mapSize > 0 || manifestSize > 0;
    },

    counts() {
      const c = { total: 0, uploading: 0, importing: 0, failed: 0 };
      const map = this.getUploadMap();
      if (map.size === 0) {
        // Pre-sync phase — every manifest file is waiting to upload.
        const pre = this.getManifestFiles().length;
        c.total = pre;
        c.uploading = pre;
        return c;
      }
      for (const [, v] of map) {
        c.total += 1;
        if (v.status === "failed") c.failed += 1;
        else if (v.status === "processing" || v.status === "finalized")
          c.importing += 1;
        else c.uploading += 1;
      }
      return c;
    },

    allDone() {
      const c = this.counts;
      return c.total > 0 && c.uploading === 0 && c.failed === 0;
    },

    pillVariantClass() {
      if (this.counts.failed > 0) return "upload-pill--failed";
      if (this.allDone) return "upload-pill--done";
      return "";
    },

    pillLabel() {
      const c = this.counts;
      if (c.failed > 0) {
        const word = c.failed === 1 ? "upload failed" : "uploads failed";
        return `${c.failed} ${word}`;
      }
      if (c.uploading > 0) {
        const done = c.total - c.uploading;
        return `Uploading ${done} of ${c.total}\u2026`;
      }
      if (c.importing > 0) {
        return `Importing ${c.importing} of ${c.total}\u2026`;
      }
      const word = c.total === 1 ? "file" : "files";
      return `${c.total} ${word} uploaded`;
    },

    destinationFolder() {
      const dest = this.getUploadDestination();
      return (dest && dest.file) || null;
    },
  },

  methods: {
    jumpToDestination() {
      const folder = this.destinationFolder;
      if (!folder || !folder.content) return;
      const packageType = folder.content.packageType;
      const id = folder.content.id;
      if (!id) return;
      if (packageType === "Collection") {
        this.$router.push({
          name: "dataset-files",
          params: {
            ...this.$route.params,
            fileId: id,
          },
        });
      } else if (packageType === "DataSet") {
        this.$router.push({
          name: "dataset-files",
          params: {
            ...this.$route.params,
            fileId: undefined,
          },
        });
      }
    },

    onDismiss() {
      // resetUpload clears uploadFileMap + manifestFiles + progress totals.
      // In-flight S3 PUTs continue (they hold their own references), but
      // the UI stops tracking them.
      this.$store.dispatch("uploadModule/resetUpload");
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../../styles/theme";

.upload-pill {
  align-items: center;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  gap: 8px;
  left: 50%;
  max-width: 320px;
  padding: 6px 8px 6px 12px;
  position: absolute;
  top: 8px;
  transform: translateX(-50%);
  z-index: 10;

  &:hover {
    background: theme.$gray_0;
  }
}

.upload-pill--failed {
  border-color: theme.$red_tint;
  .pill-label {
    color: theme.$red_1;
  }
}

.upload-pill--done {
  border-color: theme.$gray_2;
}

.pill-icon {
  flex-shrink: 0;
}

.pill-label {
  color: theme.$gray_6;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-dismiss {
  align-items: center;
  background: none;
  border: none;
  color: theme.$gray_4;
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  height: 20px;
  justify-content: center;
  padding: 0;
  width: 20px;

  &:hover {
    color: theme.$gray_6;
  }
}

.pill-fade-enter-active,
.pill-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.pill-fade-enter-from,
.pill-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}
</style>
