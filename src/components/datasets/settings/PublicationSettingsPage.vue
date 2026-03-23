<template>
  <bf-stage ref="bfStage" slot="stage">
    <template v-if="hasPermission">
      <div class="publication-settings-container">
        <div class="pub-section">
          <div class="pub-section-header">License</div>
          <div class="pub-section-content">
            <dataset-license
              id="inputLicense"
              @change-license="saveLicenseChange"
            />
          </div>
        </div>

        <div class="pub-section">
          <div class="pub-section-header">Contributors</div>
          <div class="pub-section-content">
            <dataset-settings-contributors ref="inputAddContributor" />
          </div>
        </div>

        <div class="pub-section">
          <div class="pub-section-header">References</div>
          <div class="pub-section-content">
            <dataset-settings-associated-publications />
          </div>
        </div>

        <div class="pub-section">
          <div class="pub-section-header">Ignore Files</div>
          <div class="pub-section-content">
            <dataset-settings-ignore-files />
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <bf-empty-page-state class="empty">
        <img
          src="/src/assets/images/illustrations/illo-collaboration.svg"
          height="240"
          width="247"
          alt="Publishing illustration"
        />
        <div class="copy">
          <h2>You don't have permission to manage publishing for this dataset.</h2>
          <p>Only dataset managers can access this page.</p>
        </div>
      </bf-empty-page-state>
    </template>
  </bf-stage>
</template>

<script>
import { mapGetters, mapState, mapActions } from "vuex";
import { pathOr } from "ramda";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import BfStage from "../../layout/BfStage/BfStage.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import DatasetLicense from "./DatasetLicense/DatasetLicense.vue";
import DatasetSettingsContributors from "./DatasetSettingsContributors/DatasetSettingsContributors.vue";
import DatasetSettingsAssociatedPublications from "./DatasetSettingsAssociatedPublications/DatasetSettingsAssociatedPublications.vue";
import DatasetSettingsDoi from "./DatasetSettingsDoi/DatasetSettingsDoi.vue";
import DatasetSettingsIgnoreFiles from "./DatasetSettingsIgnoreFiles/DatasetSettingsIgnoreFiles.vue";

export default {
  name: "PublicationSettingsPage",

  components: {
    BfStage,
    BfEmptyPageState,
    DatasetLicense,
    DatasetSettingsContributors,
    DatasetSettingsAssociatedPublications,
    DatasetSettingsDoi,
    DatasetSettingsIgnoreFiles,
  },

  computed: {
    ...mapGetters(["getPermission", "config"]),
    ...mapState(["dataset"]),

    hasPermission() {
      return this.getPermission("manager");
    },
  },

  methods: {
    ...mapActions(["updateDataset"]),

    async saveLicenseChange() {
      try {
        const token = await useGetToken();
        const datasetId = pathOr('', ['content', 'id'], this.dataset);
        const url = `${this.config.apiUrl}/datasets/${datasetId}?api_key=${token}`;
        const response = await fetch(url, {
          method: 'PUT',
          body: JSON.stringify({ license: this.dataset.content.license }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const updated = await response.json();
          this.updateDataset({ ...this.dataset, ...updated });
        }
      } catch (err) {
        console.error('Failed to save license:', err);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.publication-settings-container {
  max-width: 640px;
}

.pub-section {
  margin-bottom: 24px;
}

.pub-section-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_5;
  padding: 8px 0;
  margin: 0 0 16px;
  border-bottom: 1px solid theme.$gray_2;
}

.pub-section-content {
  padding-bottom: 0;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 48px 24px;

  .copy {
    h2 {
      font-size: 16px;
      font-weight: 600;
      color: theme.$gray_6;
      margin: 16px 0 8px;
    }

    p {
      color: theme.$gray_5;
      font-size: 13px;
      line-height: 1.5;
    }
  }
}
</style>
