<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template>
  <locked-banner slot="banner" />

  <bf-rafter slot="heading">
    <template #breadcrumb v-if="route.meta.showBackToFiles">
      <a @click="$router.go(-1)" class="link-to-files">
        <IconArrowLeft :height="10" :width="10" />
        Back to Files
      </a>
    </template>

    <template #heading>
      <div class="title-wrapper">
        <h1 class="flex-heading">
          {{ pageName }}
        </h1>
      </div>
    </template>
  </bf-rafter>
</template>

<script>
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";
import IconGuide from "../../components/icons/IconGuide.vue";
import IconHelp from "../../components/icons/IconHelp.vue";
import IconArrowRight from "../../components/icons/IconArrowRight.vue";
import IconUpload from "../../components/icons/IconUpload.vue";

export default {
  name: "SecondaryPageHeader",

  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner,
    IconGuide,
    IconHelp,
    IconArrowRight,
    IconUpload,
  },
  mounted() {
    const r = useRoute();
    // this.getReadmeDocument(r.meta.helpSection);
  },

  computed: {
    pageName: function () {
      const r = useRoute();

      switch (r.name) {
        case "dataset-settings":
          return "Dataset Settings";
        case "dataset-files":
          return "Files";
        case "file-record":
          return "File Details";
        case "publishing-settings":
          return "Dataset Publishing";
        case "dataset-activity":
          return "Dataset Activity";
        case "integrations-settings":
          return "Dataset Integrations";
        case "collection-files":
          return "Files";
        case "viewer":
          return "File Viewer";
      }
      return "Unknown";
    },
  },

  data() {
    return {
      showHelp: false,
    };
  },

  methods: {
    toggleHelp: function () {
      this.showHelp = !this.showHelp;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.flex-heading {
  background-color: $purple_1;
}

.el-collapse-item__header {
  background: $purple_2;
}

.link-to-files {
  color: $white;
  cursor: pointer;
}
</style>
