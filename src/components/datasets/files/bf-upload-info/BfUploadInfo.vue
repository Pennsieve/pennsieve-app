<template>
  <transition name="dialog-fade">
    <div class="bf-upload-info">
      <div v-if="getIsUploading" class="copy">
        <strong> {{ uploadCopy }}</strong>

        <bf-progress-bar
          :loaded="getUploadProgress().loaded"
          :total="getUploadProgress().total"
        />
      </div>
      <div v-else class="copy">
        {{ uploadCopy }}
      </div>
      <div class="upload-details">
        <button class="show-details" @click="showUpload">Show details</button>
        <div v-if="getIsUploading">
          <strong>{{ loadedStr }}</strong>
          of {{ totalStr }}
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

export default {
  name: "BfUploadInfo",

  components: {
    BfProgressBar,
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
    ]),

    /**
     * Compute copy based on how many files are being uploaded
     * @returns {String}
     */
    uploadCopy: function () {
      if (this.getUploadComplete()) {
        return "";
      }
      const file = this.getUploadMap().size > 1 ? "files" : "file";
      return `Uploading ${this.getUploadMap().size} ${file}`;
    },

    loadedStr: function () {
      return this.formatMetric(this.getUploadProgress().loaded);
    },
    totalStr: function () {
      return this.formatMetric(this.getUploadProgress().total);
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
      EventBus.$emit("dismiss-upload-info");
      EventBus.$emit("close-uploader");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

.bf-upload-info {
  background: $gray_1;
  border-radius: 4px;
  box-shadow: 0 0 1px 0 rgba(0, 0, 0, 0.21), 0 0 5px 0 rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  font-size: 13px;
  margin-left: -240px;
  left: 50%;
  padding: 8px 16px;
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
  color: $app-primary-color;
  text-decoration: underline;
}
.upload-details {
  display: flex;
  margin-top: 4px;
}
.show-details {
  flex: 1;
  text-align: left;
}
</style>
