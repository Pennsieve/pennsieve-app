<template>
  
  <div class="owner-orcid">
    <div v-if="!hasOrcidId">
      <p class="sharing-blurb">
        Connect your ORCID iD to your Pennsieve account to enable publishing.
        <a
          href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform"
          target="_blank"
          alt="ORCID learn more link"
        >
          Learn More
        </a>
      </p>
      <router-link
        class="bf-menu-item"
        :to="{
          name: 'my-settings-container',
          params: { orgId: this.activeOrganizationId },
        }"
      >
        Connect ORCID iD in user profile menu
      </router-link>
    </div>

    <div v-else>
      <div>
        <p class="orcid-success-text blurb">
          Below is the ORCID associated with your Pennsieve account.
          <a
            href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform"
            target="_blank"
          >
            Learn More
          </a>
        </p>
        <div v-if="!loadingOrcid" class="integration-success">
          <img src="/src/assets/images/orcid.png" />
          <el-row
            class="orcid-success-info"
            type="flex"
            align="middle"
            alt="Logo for ORCID"
          >
            <el-col>
              <a :href="getORCIDResultUrl" target="_blank">
                {{ getORCIDResultUrl }}
              </a>
            </el-col>
          </el-row>
          <el-col class="orcid-delete-button">
            <button @click="openORCIDWindow">
              <IconRemove :height="10" :width="10" />
            </button>
          </el-col>
        </div>
        <div v-else class="orcid-waiting">
          <el-row><div v-loading="loadingOrcid" class="orcid-loader" /></el-row>
        </div>
        <el-row class="mt-20" v-if="!publishToOrcid">
          <router-link
            class="bf-menu-item"
            :to="{
              name: 'my-settings-container',
              params: { orgId: this.activeOrganizationId },
            }"
          >
            Allow Pennsieve to publish works to ORCHID
          </router-link>
        </el-row>
      </div>
    </div>
    <delete-orcid
      :visible="deleteOrcidDialogVisible"
      @orcid-deleted="updateORCID"
      @close-orcid-dialog="closeOrcidDialog"
    />
  </div>
</template>

<script>
import BfButton from "../../../shared/bf-button/BfButton.vue";
import DeleteOrcid from "../../../my-settings/windows/DeleteOrcid.vue";
import { mapGetters, mapState, mapActions } from "vuex";
import { pathOr } from "ramda";
import IconRemove from "../../../icons/IconRemove.vue";
export default {
  name: "OwnerOrcid",

  components: {
    IconRemove,
    BfButton,
    DeleteOrcid,
  },

  data() {
    return {
      loadingOrcid: false,
      deleteOrcidDialogVisible: false,
    };
  },

  computed: {
    ...mapGetters([
      "datasetOwnerHasOrcidId",
      "hasOrcidId",
      "publishToOrchid",
      "profile",
    ]),

    ...mapState(["config", "activeOrganization"]),

    /**
     * Compute active organization id
     * @returns {String}
     */
    activeOrganizationId: function () {
      return pathOr(
        "Organization",
        ["organization", "id"],
        this.activeOrganization
      );
    },
    /**
     * Retrieves Url to display with name once ORCID is connected to user profile
     */
    getORCIDResultUrl: function () {
      const env = pathOr("", ["config", "environment"])(this);
      return env === "dev"
        ? `https://sandbox.orcid.org/${this.profile.orcid.orcid}`
        : `https://orcid.org/${this.profile.orcid.orcid}`;
    },
  },

  methods: {
    ...mapActions(["updateProfile"]),

    /**
     * Function that's called after ORCID is deleted
     */
    updateORCID: function () {
      this.updateProfile({
        ...this.profile,
        orcid: {},
      });
    },

    /**
     * Opens deleteORCID modal
     * @param {String} refName
     */
    openORCIDWindow: function () {
      this.deleteOrcidDialogVisible = true;
    },

    /**
     * Closes deleteORCID modal
     */
    closeOrcidDialog: function () {
      this.deleteOrcidDialogVisible = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../../../assets/_variables.scss";

.integration-success {
  border: solid 1px #dadada;
  padding: 10px;
  display: flex;
  flex-direction: row;
  background: #fff;

  .orcid-waiting {
    padding-top: 30px;
    padding-bottom: 20px;
    flex: 1;
  }

  .orcid-waiting {
    padding-top: 30px;
    padding-bottom: 20px;
    flex: 1;
  }

  .orcid-success-info {
    .orcid-success-text {
      margin-left: 10px;
      margin-top: 8px;
      margin-bottom: 0;

      a {
        margin-left: 3px;
      }
    }

    a {
      margin-left: 10px;
    }
  }

  img {
    width: 30px;
    height: 30px;
  }

  .orcid-delete-button {
    flex: 1;
    flex-direction: row-reverse;

    button {
      color: $gray_4;
      margin-top: 7px;
      &:hover,
      &:focus {
        cursor: pointer;
        color: $purple_1;
      }
    }
  }

  .el-row--flex.is-align-middle {
    flex: 27;
  }
}

.mt-20 {
  margin-top: 20px;
}

p {
  color: black;
}
</style>
