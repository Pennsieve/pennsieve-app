<template>
  <transition name="dialog-fade">
    <div class="bf-upload-info">
      <button class="dismiss-btn" @click="onDismiss" title="Dismiss">
        <IconRemove />
      </button>
      <div v-if="getIsUploading" class="copy">
        <strong> {{ uploadCopy }}</strong>

        <bf-progress-bar
          :loaded="getUploadProgress().loaded"
          :total="getUploadProgress().total"
          :complete="allFilesComplete"
        />
      </div>
      <div v-else class="copy">
        {{ uploadCopy }}
      </div>
      <div class="upload-details">
        <button class="show-details" @click="showUpload">Show details</button>
        <div v-if="getIsUploading && !allFilesComplete">
          <strong>{{ loadedStr }}</strong>
          of {{ totalStr }}
        </div>
        <div v-else-if="allFilesComplete" class="complete-text">
          Uploading...
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { propOr } from "ramda";
import BfProgressBar from "../../../shared/bf-progress-bar/bf-progress-bar.vue";
import BfStorageMetrics from "../../../../mixins/bf-storage-metrics";
import EventBus from "../../../../utils/event-bus";
import IconRemove from "../../../icons/IconRemove.vue";

export default {
  name: "BfUploadInfo",

  components: {
    BfProgressBar,
    IconRemove,
  },

  mixins: [BfStorageMetrics],

  data() {
    return {};
  },

  computed: {
    ...mapGetters("uploadModule", [
      "getUploadProgress",
      "getIsUploading",
      "getUploadMap",
      "getUploadComplete",
      "getTotalFilesInBatch",
    ]),

    /**
     * Compute copy based on how many files are being uploaded
     * @returns {String}
     */
    uploadCopy: function () {
      if (this.getUploadComplete()) {
        return "";
      }
      const totalFiles = this.getTotalFilesInBatch();
      const file = totalFiles > 1 ? "files" : "file";
      return `Uploading ${totalFiles} ${file}`;
    },

    loadedStr: function () {
      return this.formatMetric(this.getUploadProgress().loaded);
    },
    totalStr: function () {
      return this.formatMetric(this.getUploadProgress().total);
    },

    /**
     * Check if all files have completed uploading (in processing state)
     * @returns {Boolean}
     */
    allFilesComplete: function () {
      const uploadMap = this.getUploadMap();
      if (uploadMap.size === 0) return false;
      for (const [, value] of uploadMap) {
        if (value.status !== "processing") {
          return false;
        }
      }
      return true;
    },
  },

  methods: {
    /**
     * Show uploader
     * @returns {String}
     */
    showUpload: function () {
      EventBus.$emit("open-uploader", false);
    },

    /**
     * Dismiss status bar and clear uploaded files in bf-upload
     */
    onDismiss: function () {
      this.$store.dispatch("uploadModule/resetUpload");
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../../styles/theme";

.bf-upload-info {
  background: theme.$gray_1;
  border-radius: 4px;
  box-shadow: 0 0 1px 0 rgba(0, 0, 0, 0.21), 0 0 5px 0 rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  font-size: 13px;
  margin-left: -240px;
  left: 50%;
  padding: 8px 16px;
  padding-right: 40px;
  position: absolute;
  top: 8px;
  width: 480px;
  z-index: 10;

  .bf-progress-bar {
    display: block !important;
    margin: 4px 0;
    width: 100% !important;
  }
}
button {
  color: theme.$app-primary-color;
  text-decoration: underline;
}
.dismiss-btn {
  position: absolute;
  right: 8px;
  top: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  text-decoration: none;
  color: theme.$gray_4;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: theme.$gray_6;
  }

  .svg-icon {
    width: 16px;
    height: 16px;
  }
}
.upload-details {
  display: flex;
  margin-top: 4px;
}
.show-details {
  flex: 1;
  text-align: left;
}
.complete-text {
  color: theme.$green_1;
  font-weight: 500;
}
</style>
