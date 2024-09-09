<template>
  <div class="list-item">
    <el-row :gutter="40">
      <el-col :span="12" class="repo-banner-container">
        <div>
          <img src="../../assets/images/octocat.png" alt="Octocat" />
        </div>
        <div v-if="myReposView" class="repo-info-container">
          <h2>
            {{ repo.name }}
          </h2>
          <p>
            {{ repo.description }}
          </p>
        </div>
        <div v-if="workspaceReposView" class="repo-info-container">
          <h2>
            {{ repo.content.name }}
          </h2>
          <p>
            {{ repo.content.description }}
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
            <strong>{{ repo.content.intId }}</strong>
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
              :indicator-color="trackingStatus.untracked.color"
              :label="trackingStatus.untracked.label"
            >
            </tag-pill>
          </div>
          <!-- <div class="mt-8" v-if="workspaceReposView">DOI or N/A</div> -->
        </div>
      </el-col>
      <el-col :span="7" class="actions-container">
        <button
          v-if="myReposView || isRepoOwner"
          @click="handleTrackingClick"
          class="text-button"
        >
          Start Tracking
        </button>
        <button
          v-if="myReposView || isRepoOwner"
          @click="handleTrackingClick"
          class="text-button"
        >
          Stop Tracking
        </button>
        <button @click="handleConfigureClick" class="text-button">
          Configure
        </button>
        <button @click="handlePublishLatestClick" class="text-button">
          Publish
        </button>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { Link } from "@element-plus/icons-vue";
import { mapActions, mapGetters, mapState } from "vuex";
import TagPill from "../shared/TagPill/TagPill.vue";
import { find, propEq, propOr } from "ramda";
import FormatDate from "../../mixins/format-date";

export default {
  name: "RepoListItem",
  components: {
    Link,
    TagPill,
  },

  mixins: [FormatDate],

  props: {
    repo: {
      type: Object,
      required: true,
    },
    // currently isTracked value is not available from the repo object, integrate it when available
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
    };
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
  },
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos"]),
    handleTrackingClick: function () {
      console.log("tracking click");
    },
    handleConfigureClick: function () {
      console.log("configure click");
    },
    handlePublishLatestClick: function () {
      console.log("publish latest click");
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

.actions-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

.repo-banner-container {
  display: flex;
  flex-direction: row;
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
  padding: 24px;
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
