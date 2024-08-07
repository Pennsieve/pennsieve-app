<template>
  <bf-page>
    <bf-rafter slot="heading" title="Releases" class="primary" :org-id="orgId">
      <template #description>
        <div class="description">
          <p>
            List of Github repositories, and the github type datasets for the organization
          </p>
        </div>
      </template>
      <template #tabs>
        <router-tabs :tabs="tabs" />
      </template>
    </bf-rafter>
    <router-view name="stage"/>
  </bf-page>
</template>

<script>
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

export default {
  name: "PennsieveReleases",
  components: {
    RouterTabs,
    BfPage,
    BfStage,
    BfRafter,
  },
  // From Router
  props: {
    orgId: {
      type: String,
      default: "",
    }
  },
  data() {
    return {
      tabs: [
        {
          name: "Github Repositories", //display name
          to: "github-repos",
        },
        {
          name: "Github Release Datasets", //display name
          to: "github-datasets",
        },
      ],
    };
  },
};
</script>

<style scoped lang="scss">

.description {
  max-width: 600px;
}
</style>
