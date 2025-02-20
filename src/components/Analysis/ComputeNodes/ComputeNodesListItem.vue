<template>
  <div class="integration-list-item">
    <div class="flex-row">
      <div class="compute-node-title">
        {{ computeNode.name }}
        <div class="compute-node-account-info margin-top">
          ({{ computeNode.account.accountType }}) #{{
            computeNode.account.accountId
          }}
        </div>
      </div>
      <el-dropdown class="options-icon" trigger="click" placement="bottom-end">
        <span class="btn-file-menu el-dropdown-link">
          <IconMenu :height="20" :width="20" />
        </span>
        <template #dropdown>
          <el-dropdown-menu slot="dropdown" class="bf-menu" :offset="9">
            <el-dropdown-item
              :disabled="!hasAdminRights"
              @click="isEditComputeNodeDialogOpen = true"
            >
              <el-tooltip
                ;disabled="hasAdminRights"
                class="box-item"
                effect="dark"
                content="Only admin users can edit compute nodes"
                placement="top-start"
              >
                Edit Compute Node
              </el-tooltip>
            </el-dropdown-item>

            <el-dropdown-item
              @click="isDeleteComputeNodeDialogOpen = true"
              :disabled="!isOwner"
            >
              <el-tooltip
                :disabled="isOwner"
                class="box-item"
                effect="dark"
                :content="deleteComputeNodeButtonTooltip"
                placement="top-start"
              >
                Delete Compute Node
              </el-tooltip>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <!-- <div>
        <el-tooltip
          class="box-item"
          effect="dark"
          :content="deleteComputeNodeButtonTooltip"
          placement="right-start"
        >
          <el-button
            :disabled="!isOwner"
            @click="isDeleteComputeNodeDialogOpen = true"
          >
            <el-icon :size="24">
              <CircleClose />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div> -->
    </div>
    <div class="margin-10">
      <div>
        <div class="margin-10">
          Created Date: {{ this.formatDateFNS(computeNode.createdAt) }}
        </div>
        <div class="margin-10">
          {{ computeNode.description }}
        </div>
      </div>
    </div>
    <el-dialog
      v-model="isDeleteComputeNodeDialogOpen"
      width="500"
      @close="isDeleteComputeNodeDialogOpen = false"
    >
      <template #header>
        <bf-dialog-header slot="title" title="Delete Compute Node" />
      </template>
      <span> Would you like to delete this compute node? </span>
      <template #footer>
        <div class="dialog-footer">
          <bf-button
            class="secondary"
            @click="isDeleteComputeNodeDialogOpen = false"
            >No</bf-button
          >
          <bf-button @click="handleDeleteComputeNode">Yes</bf-button>
        </div>
      </template>
    </el-dialog>
    <edit-compute-node-dialog
      :selectedComputeNode="computeNode"
      v-model="isEditComputeNodeDialogOpen"
    />
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { mapActions, mapState } from "vuex";
import FormatDate from "../../../mixins/format-date";
import { pathOr, propOr } from "ramda";
import { CircleClose } from "@element-plus/icons-vue";
import EventBus from "../../../utils/event-bus";
import EditComputeNodeDialog from "./EditComputeNodeDialog.vue";

export default {
  name: "ComputeNodesListItem",

  components: {
    CircleClose,
  },

  props: {
    computeNode: {
      type: Object,
      default: () => ({}),
    },
  },

  mixins: [FormatDate, Request],

  computed: {
    ...mapState(["orgMembers", "profile"]),
    ...mapGetters(["activeOrganization", "config"]),
    /**
     * Active organization name
     * @returns {String}
     */
    activeOrgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return false;
      }
    },
    isOwner: function () {
      return propOr(false, "isOwner", this.activeOrganization);
    },
    deleteComputeNodeButtonTooltip: function () {
      return this.isOwner
        ? "Delete this Compute Node"
        : "Only Workspace Owners can delete Compute Nodes";
    },
  },

  data: function () {
    return {
      isDeleteComputeNodeDialogOpen: false,
      isEditComputeNodeDialogOpen: false,
    };
  },
  methods: {
    ...mapActions(["updateDataset"]),
    ...mapActions("analysisModule", ["deleteComputeNode"]),
    handleDeleteComputeNode: async function () {
      try {
        await this.deleteComputeNode(this.computeNode);

        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: "Your cancellation request was successful. It may take some time to complete.",
          },
        });
      } catch (error) {
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "Something went wrong, please try again later.",
          },
        });
      } finally {
        this.isDeleteComputeNodeDialogOpen = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.margin-10 {
  margin: 10px;
}

.margin-top {
  margin-top: 10px;
}

.flex-row {
  display: flex;
  justify-content: space-between;
  background: $purple_tint;
  padding: 8px 16px;
  height: 64px;
  align-items: center;
}

.integration-menu {
  width: 24px;
}

.integration-list-item {
  width: 90%;
  height: 175px;
  border: 1px solid $gray_3;
  margin: 0 8px 16px 8px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.integration-title {
  font-size: 16px;
  margin: 16px 4px;
  color: black;
  text-align: center;
}

.compute-node-title {
  color: $gray_5;
  font-weight: 500;
  font-size: 18px;
  margin: 20px 0px;
}

.compute-node-account-info {
  color: $gray_4;
  font-weight: 500;
  font-size: 18px;
}

.activeSwitch {
  text-align: end;
}

.integration-description {
  font-size: 14px;
  color: $gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 0 8px;
  overflow-wrap: break-word;
}

.list-item-col-spacer {
  padding-top: 32px;
}

.options-icon {
  float: right;
}

.userIcon {
  /* bottom: 0; */
  height: 100%;
  /* right: 0; */
  /* place-self: flex-end; */
  align-self: self-end;
  /* flex-direction: column; */
  display: flex;
  flex-direction: column-reverse;
  margin: 8px;
}
</style>
