<template>
  <div v-if="visible" class="dataset-finder-backdrop" @click.self="closeDialog">
    <div class="dataset-finder-dialog">
      <div class="dialog-header">
        <h2>Manage Collection Datasets</h2>
        <button class="close-button" @click="closeDialog">×</button>
      </div>
      
      <div class="dialog-body">
        <!-- Search Bar -->
        <div class="search-section">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search for datasets..."
            class="search-input"
            @input="onSearch"
          />
        </div>

        <!-- Dataset List Controls -->
        <div v-if="datasets.length > 0" class="dataset-list-controls-wrap">
          <dataset-list-controls
            :total="totalCount"
            :page-size="pageSize"
            @update:page-size="updatePageSize"
            @set-list-options="setListOptions"
          />
          
          <div class="pagination-wrapper">
            <el-pagination
              v-show="totalCount > pageSize"
              :page-size="pageSize"
              :pager-count="5"
              v-model:current-page="currentPage"
              layout="prev, pager, next"
              :total="totalCount"
              @current-change="onPaginationChange"
            />
          </div>
        </div>

        <!-- Dataset List -->
        <div class="datasets-container">
          <div v-if="isLoading" class="loading-state">
            <div v-for="n in 5" :key="n" class="dataset-loader">
              <div class="loader-content">
                <div class="loader-checkbox"></div>
                <div class="loader-text">
                  <div class="loader-title"></div>
                  <div class="loader-description"></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="datasets.length > 0" class="datasets-list">
            <dataset-card-selector
              v-for="dataset in filteredDatasets"
              :key="dataset.id"
              :dataset="dataset"
              :is-selected="isSelected(dataset.id)"
              @toggle-selection="toggleDataset"
            />
          </div>

          <div v-else class="empty-state">
            <p>No datasets available</p>
            <p class="help-text">Try adjusting your search criteria</p>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
        <bf-button
          class="primary"
          :disabled="hasChanges === false || isUpdating"
          @click="updateDatasets"
        >
          <span v-if="isUpdating">Updating...</span>
          <span v-else>{{ updateButtonText }}</span>
        </bf-button>
      </div>
    </div>
  </div>
</template>

<script>
import { useCollectionsStore } from '@/stores/collectionStore'
import DatasetCardSelector from './DatasetCardSelector.vue'
import DatasetListControls from './DatasetListControls.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: 'DatasetFinderDialog',

  components: {
    BfButton,
    DatasetCardSelector,
    DatasetListControls
  },

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    collectionId: {
      type: [String, Number],
      required: true
    },
    currentDatasets: {
      type: Array,
      default: () => []
    }
  },

  setup() {
    const collectionsStore = useCollectionsStore()
    return {
      collectionsStore
    }
  },

  data() {
    return {
      searchQuery: '',
      datasets: [],
      filteredDatasets: [],
      selectedDatasets: [],
      initialSelectedDatasets: [], // Track initially selected datasets
      isLoading: false,
      isUpdating: false,
      currentPage: 1,
      pageSize: 25,
      totalCount: 0,
      searchTimeout: null // For debouncing search input
    }
  },

  computed: {
    totalPages() {
      return Math.ceil(this.totalCount / this.pageSize)
    },

    hasChanges() {
      // Check if selected datasets differ from initial selection
      if (this.selectedDatasets.length !== this.initialSelectedDatasets.length) {
        return true
      }
      
      const selectedIds = this.selectedDatasets.map(d => d.id).sort()
      const initialIds = this.initialSelectedDatasets.map(d => d.id).sort()
      
      return selectedIds.some((id, index) => id !== initialIds[index])
    },

    datasetsToAdd() {
      return this.selectedDatasets.filter(dataset => 
        !this.initialSelectedDatasets.some(initial => initial.id === dataset.id)
      )
    },

    datasetsToRemove() {
      return this.initialSelectedDatasets.filter(dataset => 
        !this.selectedDatasets.some(selected => selected.id === dataset.id)
      )
    },

    updateButtonText() {
      const toAdd = this.datasetsToAdd.length
      const toRemove = this.datasetsToRemove.length
      
      if (toAdd > 0 && toRemove > 0) {
        return `Update Collection (${toAdd} to add, ${toRemove} to remove)`
      } else if (toAdd > 0) {
        return `Add ${toAdd} Dataset${toAdd !== 1 ? 's' : ''}`
      } else if (toRemove > 0) {
        return `Remove ${toRemove} Dataset${toRemove !== 1 ? 's' : ''}`
      }
      
      return 'Update Collection'
    }
  },

  watch: {
    visible(newVal) {
      if (newVal) {
        this.loadDatasets()
        this.initializeSelectedDatasets()
        this.searchQuery = ''
      }
    },

    currentDatasets: {
      handler() {
        this.initializeSelectedDatasets()
      },
      immediate: true
    }
  },

  mounted() {
    if (this.visible) {
      this.loadDatasets()
    }
  },

  methods: {
    async loadDatasets() {
      this.isLoading = true
      
      try {
        const offset = (this.currentPage - 1) * this.pageSize
        let response
        
        // Use search API if there's a search query, otherwise load all datasets
        if (this.searchQuery && this.searchQuery.trim()) {
          response = await this.collectionsStore.searchDatasets(this.searchQuery.trim(), this.pageSize, offset)
        } else {
          response = await this.collectionsStore.getPublicDatasets(this.pageSize, offset)
        }
        
        this.datasets = response.datasets || []
        this.filteredDatasets = [...this.datasets]
        this.totalCount = response.totalCount || 0
      } catch (error) {
        console.error('Error loading datasets:', error)
        this.datasets = []
        this.filteredDatasets = []
        this.totalCount = 0
      } finally {
        this.isLoading = false
      }
    },

    initializeSelectedDatasets() {
      // Convert currentDatasets (from collection) to match the dataset structure
      this.initialSelectedDatasets = this.currentDatasets.map(dataset => {
        // Handle both formats: datasets from collection API and datasets from discover API
        const datasetObj = dataset.data || dataset
        return {
          id: datasetObj.id,
          sourceDatasetId: datasetObj.sourceDatasetId,
          name: datasetObj.name,
          description: datasetObj.description || '',
          banner: datasetObj.banner || '',
          size: datasetObj.size || 0,
          fileCount: datasetObj.fileCount || 0,
          recordCount: datasetObj.recordCount || 0,
          owner: `${datasetObj.ownerFirstName || ''} ${datasetObj.ownerLastName || ''}`.trim(),
          organizationName: datasetObj.organizationName || '',
          updatedAt: datasetObj.updatedAt || datasetObj.revisedAt || datasetObj.versionPublishedAt,
          doi: datasetObj.doi,
          version: datasetObj.version,
          revision: datasetObj.revision,
          tags: datasetObj.tags || [],
          license: datasetObj.license
        }
      })
      
      // Initialize selected datasets with current datasets
      this.selectedDatasets = [...this.initialSelectedDatasets]
    },

    async updateDatasets() {
      if (!this.hasChanges) return
      
      this.isUpdating = true
      
      try {
        // Prepare the DOI operations
        const addDois = this.datasetsToAdd
          .filter(dataset => dataset.doi)
          .map(dataset => dataset.doi)
        
        const removeDois = this.datasetsToRemove
          .filter(dataset => dataset.doi)
          .map(dataset => dataset.doi)
        
        await this.collectionsStore.editCollectionDataset(
          this.collectionId,
          addDois.length > 0 ? addDois : null,
          removeDois.length > 0 ? removeDois : null
        )

        // Emit event with the changes made
        this.$emit('datasets-updated', {
          added: this.datasetsToAdd,
          removed: this.datasetsToRemove
        })
        this.closeDialog()
      } catch (error) {
        console.error('Error updating collection datasets:', error)
        this.$emit('error', 'Failed to update collection datasets')
      } finally {
        this.isUpdating = false
      }
    },

    onSearch() {
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

      // Debounce search input by 500ms
      this.searchTimeout = setTimeout(() => {
        // Reset to first page when searching
        this.currentPage = 1
        this.loadDatasets()
      }, 500)
    },

    toggleDataset(dataset) {
      const index = this.selectedDatasets.findIndex(d => d.id === dataset.id)
      
      if (index > -1) {
        this.selectedDatasets.splice(index, 1)
      } else {
        this.selectedDatasets.push(dataset)
      }
    },

    isSelected(datasetId) {
      return this.selectedDatasets.some(d => d.id === datasetId)
    },

    async addDatasets() {
      if (this.selectedDatasets.length === 0) return
      
      this.isAdding = true
      
      try {
        const token = await useGetToken()
        const url = `${siteConfig.api2Url}/collections/${this.collectionId}`
        
        // Extract DOIs from selected datasets
        const dois = this.selectedDatasets
          .filter(dataset => dataset.doi)
          .map(dataset => dataset.doi)
        
        await useSendXhr(url, {
          method: 'PATCH',
          header: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: {
            dois: {
              add: dois
            }
          }
        })

        this.$emit('datasets-added', this.selectedDatasets)
        this.closeDialog()
      } catch (error) {
        console.error('Error adding datasets to collection:', error)
        this.$emit('error', 'Failed to add datasets to collection')
      } finally {
        this.isAdding = false
      }
    },

    closeDialog() {
      this.$emit('close')
    },

    formatSize(bytes) {
      if (!bytes) return 'Unknown'
      
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
    },

    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },

    formatNumber(number) {
      if (!number) return '0'
      return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
    },

    changePage(newPage) {
      if (newPage >= 1 && newPage <= this.totalPages) {
        this.currentPage = newPage
        this.loadDatasets()
      }
    },

    updatePageSize(newPageSize) {
      this.pageSize = newPageSize
      this.currentPage = 1
      this.loadDatasets()
    },

    setListOptions(options) {
      if (options.pageSize) {
        this.pageSize = options.pageSize
        this.currentPage = 1
        this.loadDatasets()
      }
    },

    onPaginationChange(newPage) {
      this.currentPage = newPage
      this.loadDatasets()
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';
@import '../../../styles/element/dialog';


.dataset-finder-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dataset-finder-dialog {
  background: white;
  //border-radius: 8px;
  width: 90%;
  max-width: 900px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid $gray_2;

  h2 {
    margin: 0;
    font-size: 24px;
    color: $gray_6;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 28px;
    color: $gray_4;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: $gray_6;
    }
  }
}

.dialog-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.search-section {
  margin-bottom: 24px;

  .search-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid $gray_2;
    //border-radius: 8px;
    font-size: 14px;
    box-sizing: border-box;
    
    &:focus {
      outline: none;
      border-color: $purple_1;
      box-shadow: 0 0 0 3px rgba(77, 98, 140, 0.1);
    }
  }
}

.datasets-container {
  flex: 1;
  overflow-y: auto;
}

.loading-state {
  .dataset-loader {
    background: $white;
    border: 1px solid $gray_2;
    //border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    animation: pulse 2s infinite;

    .loader-content {
      display: flex;
      gap: 16px;

      .loader-checkbox {
        width: 20px;
        height: 20px;
        background: $gray_1;
        //border-radius: 4px;
        flex-shrink: 0;
      }

      .loader-text {
        flex: 1;
        
        .loader-title {
          height: 20px;
          background: $gray_1;
          border-radius: 4px;
          margin-bottom: 8px;
          width: 60%;
        }

        .loader-description {
          height: 16px;
          background: $gray_1;
          border-radius: 4px;
          width: 90%;
        }
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;

  p {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: $gray_5;
  }

  .help-text {
    font-size: 14px;
    color: $gray_4;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid $gray_2;

  .btn-cancel, .btn-add {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel {
    background: white;
    border: 1px solid $gray_2;
    color: $gray_6;

    &:hover {
      background: $gray_1;
    }
  }

  .btn-add {
    background: $purple_1;
    border: none;
    color: white;

    &:hover:not(:disabled) {
      background: $purple_2;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.dataset-list-controls-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.pagination-wrapper {
  display: flex;
  align-items: center;
}


@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>