<template>
  <bf-stage class="list-item" element-loading-background="transparent">
    <el-row :gutter="40">
      <el-col :span="12" class="repo-banner-container">
        <div>
          <img
            v-if="repo.presignedBannerURL"
            :src="repo.presignedBannerURL"
            alt="Code repo banner image"
          />
          <img v-else src="@/assets/images/octocat.png" alt="Octocat" />
        </div>
        <div v-if="myReposView" class="repo-info-container">
          <h2>
            <a :href="getUrl">{{ repo.name }}</a>
          </h2>
          <p>
            {{ repo.description }}
          </p>
        </div>
        <div v-if="workspaceReposView" class="repo-info-container">
          <h2>
            <a :href="getUrl">{{ repo.name }}</a>
          </h2>
          <p>
            {{ repo.description }}
          </p>
          <p>
            Owned by
            <strong>{{ owner }}</strong>
          </p>
          <p>
            Last updated
            <strong>{{ updated }}</strong>
          </p>
          <p>
            Accession Number
            <strong>{{ repo.intId }}</strong>
          </p>
        </div>
      </el-col>
      <el-col :span="5" class="status-container">
        <div class="more-info-container">
          <div class="tracking-status-container">
            <tag-pill
              v-if="workspaceReposView"
              class="mt-8"
              :indicator-color="trackingStatus.tracked.color"
              :label="trackingStatus.tracked.label"
            >
            </tag-pill>
            <tag-pill
              v-if="myReposView"
              class="mt-8"
              :indicator-color="
                isTracked
                  ? trackingStatus.tracked.color
                  : trackingStatus.untracked.color
              "
              :label="
                isTracked
                  ? trackingStatus.tracked.label
                  : trackingStatus.untracked.label
              "
            >
            </tag-pill>
          </div>
          <!-- <div class="mt-8" v-if="workspaceReposView">DOI or N/A</div> -->
        </div>
      </el-col>
      <el-col :span="7" class="actions-container">
        <button
          v-if="!repo.tracking && myReposView"
          @click="handleStartTrackingClick"
          class="text-button"
        >
          Track Repository
        </button>
        <button
          v-if="repo.tracking && myReposView"
          @click="handleStopTrackingClick"
          class="text-button"
        >
          Stop Tracking
        </button>
        <!-- Link to Config View in Workspace Repos Tab -->
        <router-link
          v-if="workspaceReposView && isRepoOwner"
          :to="{
            name: 'configure-repo',
            params: { repoId: repo.name },
          }"
        >
          <button class="text-button">Configure</button>
        </router-link>
        <!-- Publish Button when Publishing Criteria is Met -->
        <button
          v-if="workspaceReposView && isRepoOwner && canPublish"
          @click="handlePublishLatestClick"
          class="text-button"
        >
          Publish
        </button>
        <!-- Publish Button when Publishing Criteria is not met -->
        <el-tooltip
          ref="tooltip"
          placement="bottom-end"
          content="Select Configure for details"
        >
          <button
            v-if="workspaceReposView && isRepoOwner && !canPublish"
            disabled
            @click="handlePublishLatestClick"
            class="text-button-disabled"
          >
            Publish
          </button>
        </el-tooltip>
      </el-col>
    </el-row>

<!--    <change-repo-tracking-dialog-->
<!--      :dialog-visible="isChangeRepoTrackingDialogVisible"-->
<!--      :start-tracking-mode="!isTracked"-->
<!--      :stop-tracking-mode="isTracked"-->
<!--      :repo="repo"-->
<!--      @close="onChangeRepoTrackingDialogClose"-->
<!--    />-->
<!--    <publish-code-repo-dialog-->
<!--      :dialog-visible="isPublishCodeRepoDialogVisible"-->
<!--      :repo="repo"-->
<!--      @close="onPublishCodeRepoDialogVisibleClose"-->
<!--    />-->
  </bf-stage>
</template>

<script>
import { Link } from "@element-plus/icons-vue";
import { mapActions, mapGetters, mapState } from "vuex";
import TagPill from "../shared/TagPill/TagPill.vue";
import { find, propEq, propOr } from "ramda";
import FormatDate from "../../mixins/format-date";
import ChangeRepoTrackingDialog from "./ChangeRepoTrackingDialog.vue";
import { hasLicense, hasReadMe, hasRelease } from "./codeReposHelpers";
import PublishCodeRepoDialog from "@/components/Code/PublishCodeRepoDialog.vue";

export default {
  name: "RepoListItem",
  components: {
    PublishCodeRepoDialog,
    Link,
    TagPill,
    ChangeRepoTrackingDialog,
  },

  mixins: [FormatDate],

  props: {
    repo: {
      type: Object,
      required: true,
    },
    isTracked: {
      type: Boolean,
      required: true,
      default: false,
    },
    /*
    myRepos and workspaceRepos props are defined as booleans, so pass the prop like this <RepoListItem myRepos>
    not like this <RepoListItem myRepos="true">
    */
    myReposView: {
      type: Boolean,
      default: false,
    },
    workspaceReposView: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      trackingStatus: {
        tracked: {
          color: "#17bb62",
          label: "Tracked",
        },
        untracked: {
          color: "#999999",
          label: "Untracked",
        },
      },
      isChangeRepoTrackingDialogVisible: false,
      isPublishCodeRepoDialogVisible: false,
    };
  },
  mounted() {
    // if (this.repo) {
    //   this.fetchReadMe(this.repo.content.id);
    // }
  },
  computed: {
    ...mapGetters(["hasFeature"]),
    ...mapState([
      "profile",
      "activeOrganization",
      "orgMembers",
      "config",
      "userToken",
      "orgDatasetStatuses",
    ]),
    ...mapState("codeReposModule", ["hasReadMe"]),

    getUrl: function () {
      if (this.workspaceReposView) return this.repo.content.releases[0].url;
      if (this.myReposView) return this.repo.url;
    },
    isRepoOwner: function () {
      const ownerId = propOr("", "owner", this.repo);
      return ownerId === propOr("", "id", this.profile);
    },
    /**
     * Compute owner of dataset
     * @returns {String}
     */
    owner: function () {
      const ownerId = propOr("", "owner", this.repo);
      if (ownerId === propOr("", "id", this.profile)) {
        return "You";
      } else {
        const owner = find(propEq("id", ownerId), this.orgMembers);
        const firstName = propOr("", "firstName", owner);
        const lastName = propOr("", "lastName", owner);

        return `${firstName} ${lastName}`;
      }
    },

    /**
     * Compute formatted timestamp
     * @returns {String}
     */
    updated: function () {
      return this.formatDate(this.repo.content.updatedAt);
    },
    canPublish: function () {
      const autoPublish = this.repo.content.repository.autoProcess;
      return (
        !autoPublish &&
        hasLicense(this.repo) &&
        hasReadMe(this.hasReadMe) &&
        hasRelease(this.repo)
      );
    },
  },
  emits:[
    'open-track-dialog'
  ],
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos", "fetchReadMe"]),
    handleStartTrackingClick: function () {
      this.startTrackingMode = true;
      this.isChangeRepoTrackingDialogVisible = true;
      this.$emit('open-track-dialog', this.repo.name)
    },
    handleStopTrackingClick: function () {
      this.stopTrackingMode = true;
      this.isChangeRepoTrackingDialogVisible = true;
      this.$emit('open-track-dialog', this.repo.name)
    },
    handlePublishLatestClick: function () {
      this.isPublishCodeRepoDialogVisible = true;
    },
    /**
     * Methods to open/close modals
     */
    onChangeRepoTrackingDialogClose: function () {
      this.isChangeRepoTrackingDialogVisible = false;
    },
    onPublishCodeRepoDialogVisibleClose: function () {
      this.isPublishCodeRepoDialogVisible = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.text-button {
  margin: 5px;
  padding: 8px 12px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease,
    color 0.3s ease;

  &:hover {
    background-color: white;
    color: #011f5b;
  }

  &:focus {
    outline: none;
  }
}
.text-button-disabled {
  margin: 5px;
  padding: 8px 12px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease,
    color 0.3s ease;
}

.actions-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

.repo-banner-container {
  display: flex;
  flex-direction: row;
  img {
    width: 80px;
    height: 80px;
  }
}

.repo-info-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  margin-left: 12px;
}

.more-info-container {
  margin: 12px;
}

.status-container {
  display: flex;
  flex-direction: column;
}
.column {
  padding: 20px;
  background-color: #f2f2f2;
  text-align: center;
  border: 1px solid #dcdcdc;
}
.list-item {
  border-bottom: 1px solid lightgray;
  box-shadow: --el-box-shadow-lighter;
}
.list-item:hover {
  background-color: $purple_tint;
}
.el-row {
  min-height: 40px;
}
.el-col {
  border-radius: 4px;
}

.grid-content {
  border-radius: 4px;
  min-height: 36px;
}
.align-content-center {
  text-align: center;
}
h3 {
  font-size: 16px;
  font-weight: 400;
  line-height: 16px;
}
</style>
