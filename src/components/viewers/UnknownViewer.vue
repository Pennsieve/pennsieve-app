<template>
  <div class="unknown-viewer">
    <div class="viewer">
      <img
        src="/src/assets/images/illustrations/spot-blackfynn-view-package.svg"
        alt="Data Types"
        height="auto"
        width="100"
        class="illustration"
      />

      <h2>{{ heading }}</h2>
      <p class="copy">{{ copy }}</p>
    </div>
  </div>
</template>

<script>
import { pathEq } from "ramda";

import BfButton from "../shared/bf-button/BfButton.vue";
import EventBus from "../../utils/event-bus";

export default {
  name: "UnknownViewer",

  components: {
    BfButton,
  },

  props: {
    pkg: Object,
    idx: Number,
  },

  computed: {
    /**
     * Confirms if package is in ERROR state
     * @returns {Boolean}
     */
    failed: function () {
      return pathEq(["content", "state"], "ERROR", this.pkg);
    },

    /**
     * True while the file waits for its malware scan (UPLOADED)
     * @returns {Boolean}
     */
    scanning: function () {
      return pathEq(["content", "state"], "UPLOADED", this.pkg);
    },

    heading: function () {
      if (this.scanning) {
        return "Scanning for malware";
      }
      if (this.failed) {
        return "Not available";
      }
      return "No preview available";
    },

    copy: function () {
      if (this.scanning) {
        return "This file can be viewed and downloaded once the scan finishes.";
      }
      if (this.failed) {
        return "This file can't be viewed or downloaded.";
      }
      return "There is no viewer for this file. Download it to open it.";
    },
  },

  methods: {
    /**
     * Fires an event to download original files
     */
    downloadFile: function () {
      EventBus.$emit("trigger-download", [this.pkg]);
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.unknown-viewer {
  box-sizing: border-box;
  overflow: auto;
  width: 100%;
  height: 100%;
}

.viewer {
  padding: 15px;
  text-align: center;
}

.copy {
  color: theme.$gray_4;
  margin: 0 0 20px 0;
}

.illustration {
  margin-top: 40px;
}

h2 {
  line-height: 20px;
  color: theme.$purple_3;
  margin: 20px 0;
  font-weight: 300;
}
</style>
