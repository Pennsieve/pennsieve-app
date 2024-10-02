<template>
  <bf-page>
    <!-- My Repos and Workspace Repos-->
    <div v-if="configView" class="back-btn">
      <router-link :to="previousRoute">
        <button class="text-button">  <IconArrowLeft
          name="icon-arrow-left"
          :height="8"
          :width="8"
        /> Back to list</button>
      </router-link>
    </div>
    <bf-rafter
      v-if="!configView"
      slot="heading"
      title="Code Repositories"
      class="primary"
      :org-id="orgId"
    >
      <template #description>
        <div class="description">
          <p v-if="myReposView">
            <hr />
            <strong>My Repositories </strong>are your personal git repos. Only
            you can see this list of repos. <br /><br /> When a Repository is <strong>Tracked</strong> it becomes a Workspace Repository. 
            <br />
            <hr />
          </p>
          <p v-if="workspaceReposView">
            <hr />
            <strong>Workspace Repositories</strong> are tracked repositories available
            to everyone in your Organization.
            <hr />
          </p>
        </div>
      </template>
      <template #tabs>
        <router-tabs :tabs="tabs" />
      </template>
    </bf-rafter>

    <bf-rafter
      v-if="configView"
      slot="heading"
      title="Configure Repository"
      class="primary"
      :org-id="orgId"
    >
      <template #description>
        <div class="description">
          <p>Update settings and details for your repository</p>
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
  computed: {
    configView: function () {
      return this.$route.name === "configure-repo";
    },
    myReposView: function () {
      return this.$route.name === "my-repos";
    },
    workspaceReposView: function () {
      return this.$route.name === "workspace-repos";
    },

    configRepoTitle: function () {
      return `Configure Repo: ${this.$route.params.repoName}`;
    },
    previousRoute() {
      const router = this.$router;
      if (router.options.history.state.back) {
        return router.options.history.state.back;
      } else {
        return { name: "my-repos" };
      }
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
