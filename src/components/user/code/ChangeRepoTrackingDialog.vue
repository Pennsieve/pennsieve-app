<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="fixed-width"
    @close="closeDialog"
    :show-close="false"
  >
    <template #header>
      <bf-dialog-header :title="dialogTitle" @close="closeDialog" />
    </template>

    <div>
      <div v-if="repo.tracking">
        <p>
          Repository Name: <strong>{{ repo.name }}</strong>
        </p>
        <p>
          By unsubscribing a repository, Pennsieve no longer receives events
          from GitHub about repository releases. Pennsieve will no longer
          generate publications based on releases of the repository on GitHub.
        </p>
      </div>
      <div v-else>
        <p>
          Name: <strong>{{ repo.name }}</strong>
        </p>
        <p>
          Repositories are subscribed to a specific workspace on Pennsieve. The
          workspace is listed as part of the published repository record set and
          DOI.
        </p>
        <p>Select which workspace should manage the subscription:</p>
        <el-select
          v-model="selectedWorkspace"
          placeholder="Select"
          size="large"
          style="width: 240px"
        >
          <el-option
            v-for="item in workspaces"
            :key="item.organization.id"
            :label="item.organization.name"
            :value="item.organization.id"
          />
        </el-select>
      </div>
    </div>

    <!-- Buttons -->
    <template #footer>
      <bf-button @click="switchOrgAndSubmit">
        {{ trackingAction }}
      </bf-button>
      <bf-button class="secondary" @click="closeDialog"> Cancel </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import { mapGetters } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import { ElMessage } from 'element-plus'

export default {
  name: 'ChangeRepoTrackingDialog',

  components: {
    BfDialogHeader,
    BfButton
  },

  props: {
    dialogVisible: {
      type: Boolean,
      required: true,
      default: false,
    },
    repo: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      selectedWorkspace: null
    }
  },

  computed: {
    ...mapGetters(['workspaces', 'profile', 'config']),

    trackingAction() {
      return this.repo.tracking ? "Unsubscribe" : "Subscribe";
    },

    dialogTitle() {
      return this.repo.tracking
        ? "Unsubscribe repository"
        : "Subscribe repository";
    }
  },

  mounted() {
    this.selectedWorkspace = this.profile.preferredOrganization;
  },

  methods: {
    closeDialog() {
      this.$emit("close", false);
    },

    async switchOrgAndSubmit() {
      // If we are removing a subscription, first select the organization where subscription is managed
      let targetOrgId = this.selectedWorkspace;
      if (this.repo.tracking) {
        let targetOrgIntId = this.repo.details.organization_id;
        const targetOrg = this.workspaces.find(
          (ws) => ws.organization.intId === targetOrgIntId
        );
        targetOrgId = targetOrg.organization.id;
      }

      // Switch workspace prior to submitting request
      if (this.profile.preferredOrganization !== targetOrgId) {
        try {
          const token = await useGetToken();
          const switchOrgUrl = `${this.config.apiUrl}/session/switch-organization?organization_id=${targetOrgId}&api_key=${token}`;
          await useSendXhr(switchOrgUrl, { method: "PUT" });
          this.profile.preferredOrganization = this.selectedWorkspace;
          this.$emit("submit-repo-subscription");
        } catch (err) {
          ElMessage({
            showClose: false,
            type: "error",
            message: `Unable to select the organization. Please contact the Pennsieve team`,
          });
          console.log(err);
        }
      }
    }
  }
}
</script>

<style scoped lang="scss">
.text-area-wrapper {
  width: 100%;
}

.add-integration-dialog {
  .el-form-item {
    .el-form-item__label {
      font-weight: 500;
      color: $gray_5;
    }
  }

  .el-select {
    &.input-property {
      width: 100%;

      &.target {
        max-width: 200px;
        margin-right: 8px;
      }

      &.filter {
        margin-right: 8px;
      }
    }
  }

  .item-field {
    margin-bottom: 24px;
    &.has-enums {
      margin-bottom: 14px;
    }
  }

  .el-checkbox {
    &.input-property {
      width: 100%;
    }
  }

  .check-description {
    margin-left: 25px;
    line-height: 1em;
  }
  .el-checkbox__inner {
    border: 1px solid $gray_5;
  }

  .el-checkbox__label,
  .el-form-item__label {
    color: $gray_6;
    font-weight: 400;
  }

  .targetOptions {
    flex-direction: row;
    display: flex;
    margin: 8px 0;
  }

  .disabled-label {
    color: #c0c4cc;
    cursor: not-allowed;
    margin-top: 10px;
  }

  .label {
    margin-top: 10px;
  }

  .el-select-group,
  .el-select-dropdown__item {
    padding-bottom: 10px;
  }
  .item-checkbox .el-form-item__content {
    line-height: 1em;
  }
  #item-concept-title {
    #current-name {
      margin-left: 24px;
    }
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    line-height: 16px;
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    &.disabled-label {
      color: #c0c4cc;
      cursor: not-allowed;
      margin-top: -18px;
      height: 26px;
      margin-left: 25px;
    }
  }
  .el-form-item {
    .el-form-item__label {
      text-align: left;
    }
  }
  .el-dialog {
    height: auto;
    width: 524px;
  }
  .el-dialog__footer {
    width: 100%;
  }

  .string-sub-type {
    display: flex;
    flex-direction: row;
  }

  .url-format-info {
    display: block;
    font-size: 12px;
    color: $gray_6;
    margin-top: 4px;
  }

  .url-format-info a {
    color: $primary-color;
    text-decoration: none;
  }

  .url-format-info a:hover {
    text-decoration: underline;
  }
}
</style>