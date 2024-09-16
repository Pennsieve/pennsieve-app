<template>
  <bf-page>
    <!-- My Repos and Workspace Repos-->
    <div v-if="configView" class="back-btn">(6) back button</div>
    <bf-rafter
      v-if="!configView"
      slot="heading"
      title="Code Repositories"
      class="primary"
      :org-id="orgId"
    >
      <template #description>
        <div class="description">
          <p>
            List of Github Code Repositories associated with your linked Github
            Account.
          </p>
        </div>
      </template>
      <template #tabs>
        <router-tabs :tabs="tabs" />
      </template>
    </bf-rafter>
    <!-- Single Repo Config View -->

    <bf-rafter
      v-if="configView"
      slot="heading"
      title="Configure Repository"
      class="primary"
      :org-id="orgId"
    >
      <template #description>
        <div class="description">
          <p>
            Configuration settings for:
            <strong>{{ $route.params.repoName }}</strong>
          </p>
        </div>
      </template>
    </bf-rafter>
    <router-view name="stage" />
  </bf-page>
</template>

<script>
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

export default {
  name: "CodeRepos",
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
    },
    repoId: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      tabs: [
        {
          name: "My Repositories",
          to: "my-repos",
        },
        {
          name: "Workspace Repositories",
          to: "workspace-repos",
        },
      ],
    };
  },
  mounted() {
    console.log("this.$route in CodeRepos.vue", this.$route);
  },
  computed: {
    configView: function () {
      return this.$route.name === "configure-repo";
    },
    configRepoTitle: function () {
      return `Configure Repo: ${this.$route.params.repoName}`;
    },
  },
};
</script>

<style scoped lang="scss">
.back-btn {
  background-color: #f7f7f7;
  padding: 12px;
}
.description {
  max-width: 600px;
}
</style>
