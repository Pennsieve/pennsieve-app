<template>
  <div class="file-meta-data-info">
    <div class="header"><div>Details</div></div>
    <template v-if="showFileFolderInfo">
      <div class="file-info">
        <div class="key-value">
          <div class="label">Name:</div>
          <div class="value">{{ getFileInfo.Name }}</div>
        </div>
        <div class="key-value">
          <div class="label">Size:</div>
          <div class="value">{{ getFileInfo.Size }}</div>
        </div>
        <div class="key-value">
          <div class="label">Where:</div>
          <div class="value">{{ getFileInfo.Where }}</div>
        </div>
        <div class="key-value">
          <div class="label">Kind:</div>
          <div class="value">{{ getFileInfo.Kind }}</div>
        </div>
        <div class="key-value">
          <div class="label">Created:</div>
          <div class="value">{{ getFileInfo.CreatedAt }}</div>
        </div>
        <div class="key-value">
          <div class="label">Id:</div>
          <div class="value">{{ getFileInfo.PackageId }}</div>

          <IconAnnotation
            class="copy-clipboard"
            :width="28"
            :height="28"
            @click="copyPackageIdToClipboard"
          />
        </div>
      </div>
      <div
        class="record-info"
        v-for="item in curPackageMetaData"
        :key="item.id"
      >
        <div class="record-header">
          <div>{{ item.model }}</div>
          <el-popover
            placement="top-start"
            title="Information"
            width="260"
            trigger="hover"
            :content="getMessage(item.origin.node_id, item.model)"
          >
            <template #reference>
              <IconInfo :width="14" :height="14" />
            </template>
          </el-popover>
        </div>

        <div
          class="record-props"
          v-for="(value, propertyName) in item.props"
          :key="value"
        >
          <div class="record-prop-item">
            <div class="prop-label">{{ propertyName }}</div>
            <div>{{ value }}</div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="showDatasetInfo">
      <div class="key-value">
        <div class="label">Name:</div>
        <div class="value">{{ getDatasetInfo.Name }}</div>
      </div>
      <div class="key-value">
        <div class="label">Size:</div>
        <div class="value">{{ getDatasetInfo.Size }}</div>
      </div>
      <div class="key-value">
        <div class="label">Where:</div>
        <div class="value">{{ getDatasetInfo.Where }}</div>
      </div>
      <div class="key-value">
        <div class="label">Kind:</div>
        <div class="value">{{ getDatasetInfo.Kind }}</div>
      </div>
      <div class="key-value">
        <div class="label">Created:</div>
        <div class="value">{{ getDatasetInfo.CreatedAt }}</div>
      </div>

      <div class="dataset-info">
        This is the root folder of the '{{ folder.content.name }}' dataset.
      </div>
    </template>

    <template v-else>
      <div class="file-info">
        <div class="simple-message">{{ noDetailsMessage }}</div>
      </div>
    </template>

    <!-- Connected Records Section -->
    <template v-if="connectedRecords.length > 0">
      <div class="header"><div>Connected Records</div></div>
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
import { copyText } from "vue3-clipboard";
import { ref } from "vue";
import { useMetadataStore } from "../../../../stores/metadataStore";

export default {
  name: "FileMetadataInfo",

  components: { IconInfo, IconAnnotation },

  mixins: [BfStorageMetrics, FormatDate],

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
    ...mapGetters("filesModule", ["curPackageMetaData"]),
    ...mapGetters(["dataset"]),

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
  },

  watch: {
    selectedFiles(newSelectedFiles, oldQuestion) {
      if (newSelectedFiles.length == 1) {
        this.fetchMetadataForPackage(newSelectedFiles[0].content.nodeId);
        this.fetchConnectedRecords(newSelectedFiles[0].content.nodeId);
      } else if (newSelectedFiles.length == 0) {
        this.fetchMetadataForPackage(this.folder.content.id);
        this.fetchConnectedRecords(this.folder.content.id);
      }
    },
  },

  mounted: function () {},

  unmounted: function () {},

  methods: {
    ...mapActions("filesModule", ["fetchMetadataForPackage"]),

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
     * Get only the key properties from a record based on model schema
     * @param {Object} record - The record object
     * @returns {Object} Object with only key properties
     */
    getKeyProperties(record) {
      const metadataStore = useMetadataStore();
      const model = metadataStore.modelById(record.model_id);
      
      console.log('getKeyProperties - record:', record);
      console.log('getKeyProperties - model from store:', model);
      
      // Get schema from model.schema or model.latest_version.schema
      const schema = model?.schema || model?.latest_version?.schema;
      
      if (!schema || !schema.properties) {
        console.log('getKeyProperties - no schema found in model');
        return {};
      }
      
      console.log('getKeyProperties - using schema:', schema);
      console.log('getKeyProperties - schema properties:', schema.properties);
      
      const keyProperties = {};
      const recordValue = record.value || {};
      
      // Find properties marked with x-pennsieve-key: true
      Object.entries(schema.properties).forEach(([propertyName, propertySchema]) => {
        console.log(`getKeyProperties - checking property ${propertyName}:`, propertySchema);
        if (propertySchema['x-pennsieve-key'] === true && recordValue[propertyName] !== undefined) {
          console.log(`getKeyProperties - found key property ${propertyName}:`, recordValue[propertyName]);
          keyProperties[propertyName] = recordValue[propertyName];
        }
      });
      
      console.log('getKeyProperties - final key properties:', keyProperties);
      return keyProperties;
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
     * Get a concise title for a record
     * @param {Object} record - The record object
     * @returns {String} Record title
     */
    getRecordTitle(record) {
      const keyProperties = this.getKeyProperties(record);
      const keyEntries = Object.entries(keyProperties);
      
      if (keyEntries.length > 0) {
        const [firstKey, firstValue] = keyEntries[0];
        return firstValue;
      }
      
      // Fallback to truncated record ID
      return record.id ? record.id.substring(0, 8) + '...' : 'Record';
    },

    /**
     * Check if record has key properties to display
     * @param {Object} record - The record object
     * @returns {Boolean} Whether record has key properties
     */
    hasKeyProperties(record) {
      const keyProperties = this.getKeyProperties(record);
      return Object.keys(keyProperties).length > 1; // More than just the title property
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
    getMessage(itemId, modelName) {
      // Get Folder Name
      var fName = "";
      var curNodeId = "";
      if (this.singleFileSelected) {
        curNodeId = this.selectedFiles[0].content.nodeId;
      } else {
        curNodeId = this.folder.content.id;
      }

      if (curNodeId == itemId) {
        if (modelName == this.curPackageMetaData[0].model) {
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

.dataset-info {
  margin: 8px;
  font-size: 12px;
}

.file-meta-data-info {
  margin-left: 16px;
  border-radius: 4px;
  flex: 0 0 260px;
  max-width: 260px;
  overflow-wrap: anywhere;
}

.header {
  height: 38px;
  font-size: 16px;
  border-bottom: 1px solid theme.$gray_2;
  line-height: 38px;
  padding-left: 16px;
  color: theme.$purple_3;
}

.record-info {
  padding-left: 8px;
  margin: 0 8px 16px 4px;

  .record-header {
    color: theme.$purple_1;
    background: none;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    border-bottom: 1px solid theme.$gray_2;
  }

  .record-props {
    font-size: 12px;
    //margin: 0 16px 16px 16px;

    .record-prop-item {
      border-top: 1px solid theme.$gray_1;
      font-weight: 500;

      .prop-label {
        font-weight: 300;
      }
    }
  }
}

.copy-clipboard {
  align-self: center;
  color: theme.$purple_1;
  cursor: pointer;
}
.file-info {
  margin: 4px 8px 24px 4px;

  .simple-message {
    padding: 8px;
  }
}
.key-value {
  display: flex;
  flex-direction: row;
  margin-left: 8px;
  margin-top: 4px;

  .label {
    font-weight: 300;
    min-width: 50px;
    font-size: 12px;
    color: theme.$gray_5;
  }

  .value {
    margin-left: 8px;
    font-size: 12px;
    color: theme.$gray_5;
  }
}

.connected-records {
  margin: 4px 8px 24px 4px;

  .model-group {
    margin-bottom: 16px;

    .model-group-header {
      font-size: 13px;
      font-weight: 500;
      color: theme.$purple_1;
      padding: 4px 8px;
      border-bottom: 1px solid theme.$gray_2;
      margin-bottom: 8px;
    }

    .record-item {
      padding: 6px 8px;
      margin: 2px 0;
      border-radius: 3px;
      transition: background-color 0.2s ease;

      &.clickable-record {
        cursor: pointer;
        
        &:hover {
          background-color: theme.$gray_1;
        }
      }

      .record-content {
        .record-title {
          font-size: 12px;
          font-weight: 500;
          color: theme.$gray_6;
          margin-bottom: 2px;
        }

        .record-keys {
          font-size: 11px;
          color: theme.$gray_5;
          
          .key-value-pair {
            display: inline-block;
            margin-right: 12px;
            
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