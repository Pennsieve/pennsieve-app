<template>
  <div class="file-meta-data-info">
    <div class="section-header">Details</div>
    <template v-if="showFileFolderInfo">
      <div class="file-info">
        <div class="info-field">
          <div class="info-label">Name</div>
          <div class="info-value">{{ getFileInfo.Name }}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Size</div>
          <div class="info-value">{{ getFileInfo.Size }}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Location</div>
          <div class="info-value info-path">{{ getFileInfo.Where }}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Kind</div>
          <div class="info-value">{{ getFileInfo.Kind }}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Created</div>
          <div class="info-value">{{ getFileInfo.CreatedAt }}</div>
        </div>
        <div v-if="getFileInfo.PackageId" class="info-field">
          <div class="info-label">ID</div>
          <div class="info-value info-id">
            <span>{{ getFileInfo.PackageId }}</span>
            <button class="copy-btn" @click="copyPackageIdToClipboard" title="Copy ID">
              <IconCopyDocument :width="12" :height="12" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="showDatasetInfo">
      <div class="file-info">
        <div class="info-field">
          <div class="info-label">Name</div>
          <div class="info-value">/</div>
        </div>
        <div class="info-field">
          <div class="info-label">Size</div>
          <div class="info-value">{{ getDatasetInfo.Size }}</div>
        </div>
        <div class="info-field">
          <div class="info-label">Kind</div>
          <div class="info-value">Folder</div>
        </div>
        <div class="info-field">
          <div class="info-label">Created</div>
          <div class="info-value">{{ getDatasetInfo.CreatedAt }}</div>
        </div>
        <p class="dataset-note">Root folder of the '{{ folder.content.name }}' dataset.</p>
      </div>
    </template>

    <template v-else>
      <div class="file-info">
        <div class="empty-message">{{ noDetailsMessage }}</div>
      </div>
    </template>

    <!-- Connected Records Section -->
    <template v-if="connectedRecords.length > 0">
      <div class="section-header">Connected Records</div>
      <div class="connected-records">
        <div 
          class="model-group"
          v-for="(records, modelId) in groupedRecords"
          :key="modelId"
        >
          <div class="model-group-header">{{ getModelDisplayName(modelId) }}</div>
          <div 
            class="record-item clickable-record"
            v-for="record in records"
            :key="record.id"
            @click="navigateToRecord(record)"
          >
            <div class="record-content">
              <div class="record-title">{{ getRecordTitle(record) }}</div>
              <div class="record-keys" v-if="hasKeyProperties(record)">
                <span 
                  class="key-value-pair"
                  v-for="(value, key) in getKeyProperties(record)"
                  :key="key"
                >
                  <span class="key">{{ key }}:</span> {{ value }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import EventBus from "../../../../utils/event-bus";
import { mapGetters, mapActions, mapState } from "vuex";
import BfStorageMetrics from "../../../../mixins/bf-storage-metrics";
import FormatDate from "../../../../mixins/format-date";
import { compose, map, join, prepend, reverse } from "ramda";
import IconAnnotation from "../../../icons/IconAnnotation.vue";
import IconInfo from "../../../icons/IconInfo.vue";
import IconCopyDocument from "../../../icons/IconCopyDocument.vue";
import { copyText } from "vue3-clipboard";
import { ref } from "vue";
import { useMetadataStore } from "../../../../stores/metadataStore";
import { useRecordKeyProperties } from "../../../../composables/useRecordKeyProperties";

export default {
  name: "FileMetadataInfo",

  components: { IconInfo, IconAnnotation, IconCopyDocument },

  mixins: [BfStorageMetrics, FormatDate],

  setup() {
    const { getKeyProperties, hasKeyProperties, getRecordTitle } = useRecordKeyProperties();
    
    return {
      getKeyProperties,
      hasKeyProperties,
      getRecordTitle
    };
  },

  props: {
    selectedFiles: {
      type: Array,
      default: () => [],
    },
    ancestors: {
      type: Array,
      default: () => [],
    },
    folder: {
      type: Object,
      default: () => {},
    },
  },

  data: function () {
    return {
      connectedRecords: [],
      loadingRecords: false,
    };
  },

  computed: {
    ...mapGetters(["dataset"]),

    fileLocation: function () {
      const ancestors = this.folder.ancestors;
      const rootNode = "Files";

      window.relatives = ancestors;
      let path = rootNode;
      if (this.folder.ancestors && ancestors.length > 0) {
        path = compose(
          join("/"),
          prepend(rootNode),
          map((ancestor) => {
            return ancestor.content.name;
          })
        )(ancestors);
      }

      return path + "/" + this.folder.content.name;
    },

    noDetailsMessage: function () {
      if (this.selectedFiles.length == 0) {
        if (
          this.folder.content.packageType &&
          this.folder.content.packageType == "DataSet"
        ) {
          return "This is the root folder of the dataset";
        }
        return "No files selected";
      } else if (this.selectedFiles.length > 1) {
        return this.selectedFiles.length + " files selected";
      }
    },
    showDatasetInfo: function () {
      return (
        this.folder.content.packageType &&
        this.folder.content.packageType == "DataSet"
      );
    },
    singleFileSelected: function () {
      return this.selectedFiles.length == 1;
    },
    showFileFolderInfo: function () {
      return (
        (this.selectedFiles.length == 1 || this.selectedFiles.length == 0) &&
        this.folder.content.packageType &&
        this.folder.content.packageType != "DataSet"
      );
    },
    getDatasetInfo: function () {
      if (
        this.folder.content.packageType &&
        this.folder.content.packageType == "DataSet"
      ) {
        return {
          Name: "/",
          Size: this.formatMetric(this.folder.storage),
          Where: "/",
          Kind: "Folder",
          CreatedAt: this.formatDate(this.folder.content.createdAt),
        };
      }
    },
    getFileInfo: function () {
      let result;
      if (this.selectedFiles.length == 1) {
        result = {
          Name: this.selectedFiles[0].content.name,
          Size: this.formatMetric(this.selectedFiles[0].storage),
          Where: this.fileLocation,
          Kind: this.selectedFiles[0].subtype,
          CreatedAt: this.formatDate(this.selectedFiles[0].content.createdAt),
          PackageId: this.selectedFiles[0].content.nodeId,
        };
        return result;
      } else if (this.selectedFiles.length == 0) {
        if (this.folder.content.name != "") {
          result = {
            Name: this.folder.content.name,
            Size: this.formatMetric(this.folder.storage),
            Where: this.fileLocation,
            Kind: "Folder",
            CreatedAt: this.formatDate(this.folder.content.createdAt),
            PackageId: this.folder.content.nodeId,
          };
        } else {
          result = {
            Name: "/",
            Size: "",
            Where: "/",
            Kind: "Folder",
            CreatedAt: "",
            PackageId: "",
          };
        }
        return result;
      } else {
        return {};
      }
    },
    currentRouteName: function () {
      return this.$route.name;
    },
    onFilesPage: function () {
      let filesTable = ["dataset-files", "collection-files"];
      if (filesTable.includes(this.currentRouteName)) {
        return true;
      } else {
        return false;
      }
    },
    
    groupedRecords: function () {
      const grouped = {};
      this.connectedRecords.forEach(record => {
        if (!grouped[record.model_id]) {
          grouped[record.model_id] = [];
        }
        grouped[record.model_id].push(record);
      });
      return grouped;
    },
  },

  watch: {
    selectedFiles(newSelectedFiles, oldQuestion) {
      if (newSelectedFiles.length == 1) {
        this.fetchConnectedRecords(newSelectedFiles[0].content.nodeId);
      } else if (newSelectedFiles.length == 0) {
        this.fetchConnectedRecords(this.folder.content.id);
      }
    },
  },

  mounted: function () {},

  unmounted: function () {},

  methods: {

    /**
     * Fetch connected records for a package
     * @param {String} packageId - The package ID to fetch records for
     */
    async fetchConnectedRecords(packageId) {
      if (!packageId || packageId === '') {
        this.connectedRecords = [];
        return;
      }

      this.loadingRecords = true;
      try {
        const metadataStore = useMetadataStore();
        const datasetId = this.dataset?.content?.nodeId || this.$route.params.datasetId;
        
        // Fetch models to get schema information
        if (!metadataStore.modelsLoaded) {
          await metadataStore.fetchModels(datasetId);
        }
        
        const response = await metadataStore.fetchPackageConnectedRecords(datasetId, packageId, {
          page_size: 50
        });
        
        const records = response?.records || [];
        
        // Pre-fetch schemas for all unique models in the connected records
        await this.ensureModelSchemas(records, metadataStore, datasetId);
        
        this.connectedRecords = records;
      } catch (error) {
        console.error('Error fetching connected records:', error);
        this.connectedRecords = [];
      } finally {
        this.loadingRecords = false;
      }
    },

    /**
     * Get display name for a record
     * @param {Object} record - The record object
     * @returns {String} Display name
     */
    getRecordDisplayName(record) {
      const metadataStore = useMetadataStore();
      const model = metadataStore.modelById(record.model_id);
      const modelName = model?.display_name || model?.name || 'Record';
      
      // Try to get a meaningful display name from key properties
      const keyProperties = this.getKeyProperties(record);
      const keyEntries = Object.entries(keyProperties);
      
      if (keyEntries.length > 0) {
        const [firstKey, firstValue] = keyEntries[0];
        return `${modelName}: ${firstValue}`;
      }
      
      // Fallback to the record ID
      return `${modelName}: ${record.id ? record.id.substring(0, 8) + '...' : 'Unknown'}`;
    },

    /**
     * Ensure model schemas are loaded in the metadata store for all unique models in the records
     * @param {Array} records - Array of records
     * @param {Object} metadataStore - The metadata store instance
     * @param {String} datasetId - The dataset ID
     */
    async ensureModelSchemas(records, metadataStore, datasetId) {
      const uniqueModelIds = [...new Set(records.map(record => record.model_id))];
      
      for (const modelId of uniqueModelIds) {
        try {
          let model = metadataStore.modelById(modelId);
          console.log(`ensureModelSchemas - checking model ${modelId}:`, model);
          
          // If model doesn't have schema, try to load it
          if (model && (!model.schema && !model.latest_version?.schema)) {
            console.log(`ensureModelSchemas - fetching schema for model ${modelId}`);
            // Fetch the model version schema and update the model in the store
            const modelVersion = await metadataStore.fetchModelVersion(datasetId, modelId, 1);
            if (modelVersion?.schema) {
              // Update the model in the store with the schema
              model.schema = modelVersion.schema;
              console.log(`ensureModelSchemas - updated model ${modelId} with schema:`, model.schema);
            }
          }
        } catch (error) {
          console.error(`Error ensuring schema for model ${modelId}:`, error);
        }
      }
    },


    /**
     * Group connected records by model
     * @returns {Object} Records grouped by model_id
     */
    groupedRecords() {
      const grouped = {};
      this.connectedRecords.forEach(record => {
        if (!grouped[record.model_id]) {
          grouped[record.model_id] = [];
        }
        grouped[record.model_id].push(record);
      });
      return grouped;
    },

    /**
     * Get display name for a model
     * @param {String} modelId - The model ID
     * @returns {String} Model display name
     */
    getModelDisplayName(modelId) {
      const metadataStore = useMetadataStore();
      const model = metadataStore.modelById(modelId);
      return model?.display_name || model?.name || 'Records';
    },


    /**
     * Navigate to record details page
     * @param {Object} record - The record object
     */
    navigateToRecord(record) {
      if (record && record.id && record.model_id) {
        this.$router.push({
          name: 'record-details',
          params: {
            modelId: record.model_id,
            recordId: record.id
          }
        });
      }
    },
    removeThisEntireFunction_getMessage(itemId, modelName) {
      // Get Folder Name
      var fName = "";
      var curNodeId = "";
      if (this.singleFileSelected) {
        curNodeId = this.selectedFiles[0].content.nodeId;
      } else {
        curNodeId = this.folder.content.id;
      }

      if (curNodeId == itemId) {
        // Legacy code removed - this.curPackageMetaData no longer exists
        if (false) { // modelName == this.curPackageMetaData[0].model) {
          fName =
            "the selected file is directly associated with the '" +
            modelName +
            "' record.";
        } else {
          fName =
            "the selected file is associated with a record which is has the '" +
            modelName +
            "' record as its parent.";
        }
      } else if (this.folder.content.id == itemId) {
        fName =
          "the current folder is directly associated with the '" +
          modelName +
          "' record.";
      } else {
        for (let i = 0; i < this.ancestors.length; i++) {
          if (this.ancestors[i].content.nodeId == itemId) {
            fName =
              "the parent folder '" +
              this.ancestors[i].content.name +
              "' is associated with the '" +
              modelName +
              "' record.";
            break;
          }
        }
      }

      return "You are seeing this because " + fName;

      // return "You are seeing this metadata record because the folder '/d/ad//asd' is associated with the hopsital record."
    },
    copyPackageIdToClipboard() {
      const curPackage = this.getFileInfo;
      const packageId = curPackage.PackageId;
      const container = ref(null);

      copyText(packageId, undefined, (error, event) => {
        if (error) {
          EventBus.$emit("toast", {
            detail: {
              type: "error",
              msg: "Unable to copy to the clipboard",
            },
          });
        } else {
          EventBus.$emit("toast", {
            detail: {
              type: "success",
              msg: "The package ID was copied to the clipboard",
            },
          });
        }
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../../styles/theme";

.file-meta-data-info {
  border-left: 1px solid theme.$gray_2;
  flex: 0 0 280px;
  max-width: 280px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  height: 100%;
}

.section-header {
  padding: 0 16px;
  height: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_5;
  background: theme.$gray_1;
  border-bottom: 1px solid theme.$gray_2;
}

.file-info {
  padding: 16px;
}

.info-field {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: theme.$gray_4;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
}

.info-value {
  font-size: 13px;
  color: theme.$gray_6;
  line-height: 1.4;

  &.info-path {
    font-size: 12px;
    color: theme.$gray_5;
    word-break: break-all;
  }

  &.info-id {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 11px;
    color: theme.$gray_5;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
  }
}

.copy-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  color: theme.$gray_4;
  transition: color 0.15s ease, background 0.15s ease;

  &:hover {
    color: theme.$purple_3;
    background: theme.$gray_1;
  }
}

.dataset-note {
  font-size: 12px;
  color: theme.$gray_4;
  font-style: italic;
  margin-top: 16px;
}

.empty-message {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.connected-records {
  padding: 8px;

  .model-group {
    margin-bottom: 8px;

    .model-group-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: theme.$purple_2;
      padding: 4px 8px;
      margin-bottom: 4px;
    }

    .record-item {
      padding: 8px;
      border-radius: 4px;
      transition: background 0.15s ease;

      &.clickable-record {
        cursor: pointer;

        &:hover {
          background: theme.$gray_1;
        }
      }

      .record-content {
        .record-title {
          font-size: 13px;
          font-weight: 500;
          color: theme.$gray_6;
          margin-bottom: 2px;
        }

        .record-keys {
          font-size: 12px;
          color: theme.$gray_5;

          .key-value-pair {
            display: inline-block;
            margin-right: 8px;

            .key {
              font-weight: 500;
            }
          }
        }
      }
    }
  }
}
</style>
