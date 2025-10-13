<template>
  <div class="collection-details">
    <div v-if="isLoading" class="loading-state">
      <div class="loading-content">
        <div class="loader-header"></div>
        <div class="loader-description"></div>
        <div class="loader-datasets">
          <div v-for="n in 3" :key="n" class="loader-dataset"></div>
        </div>
      </div>
    </div>

    <div v-else-if="collection && collection.id" class="collection-content">
      <!-- Collection Header -->
      <div class="discover-content container-fluid">
        <collection-header
          :collection-details="collection"
          :last-updated-date="lastUpdatedDate"
          :collection-description="collectionDescription"
          @open-edit-dialog="showEditDialog = true"
          @open-dataset-finder="showDatasetFinder = true"
          @publish-collection="showPublishDialog = true"
        />
      </div>

      <!-- Collection Datasets -->
      <div class="discover-content container-fluid">
        <h3 class="discover-content-title">
          Collection Datasets
        </h3>
        
        <div v-if="datasetList && datasetList.length > 0" class="datasets-list">
          <dataset-card-collections
            v-for="dataset in datasetList"
            :key="dataset.data ? dataset.data.doi : dataset.doi"
            class="mb-16"
            :dataset="dataset.data || dataset"
          />
        </div>
        
        <div v-else class="no-datasets">
          <h5>This collection has no datasets associated with it.</h5>
          <bf-button class="secondary" @click="goToDatasets">
            Add Datasets
          </bf-button>
        </div>
      </div>

      <!-- Collection Info Section -->
<!--      <div class="dataset-info">-->
<!--        <div class="discover-content container-fluid dataset-info-container">-->
<!--          <div class="row">-->
<!--            <div class="col-xs-12">-->
<!--              <h2>About this collection</h2>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div class="row">-->
<!--            <div class="col-xs-12">-->
<!--              <h3>Publishing history</h3>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div class="row mb-24">-->
<!--            <div class="col-xs-12 info-publishing-history">-->
<!--              <div class="info-text">-->
<!--                <div class="info-text-caps">Originally Published</div>-->
<!--                <div>{{ originallyPublishedDate }}</div>-->
<!--              </div>-->
<!--              <div class="info-text">-->
<!--                <div class="info-text-caps">Last Updated</div>-->
<!--                <div>{{ lastUpdatedDate }}</div>-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div class="row share-collection">-->
<!--            <div class="col-xs-12">-->
<!--              <h3>Share this collection</h3>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div class="row mb-24">-->
<!--            <div class="col-xs-12">-->
<!--              <div class="info-icons">-->
<!--                <button-->
<!--                  @click="onClickCopy"-->
<!--                  title="Copy URL to clipboard"-->
<!--                  class="copy-button"-->
<!--                >-->
<!--                  <IconLink-->
<!--                    title="Copy To Clipboard Icon"-->
<!--                    class="icon-upload"-->
<!--                    :height="18"-->
<!--                    :width="18"-->
<!--                  />-->
<!--                </button>-->
<!--                <span v-if="showCopySuccess" class="copy-success-notification">-->
<!--                  Link copied to clipboard!-->
<!--                </span>-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div v-if="datasetTags && datasetTags.length > 0" class="row">-->
<!--            <div class="col-xs-12">-->
<!--              <h3>Tags</h3>-->
<!--              <div class="tags-list">-->
<!--                <span v-for="tag in datasetTags" :key="tag" class="tag">-->
<!--                  {{ tag }}-->
<!--                </span>-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->
    </div>

    <div v-else class="error-state">
      <h3>Collection not found</h3>
      <p>The collection you're looking for doesn't exist or has been removed.</p>
      <button class="btn-back" @click="goToCollections">
        Back to Collections
      </button>
    </div>

    <!-- Dataset Finder Dialog -->
    <dataset-finder-dialog
      :visible="showDatasetFinder"
      :collection-id="collectionId"
      :current-datasets="datasetList"
      @close="showDatasetFinder = false"
      @datasets-updated="onDatasetsUpdated"
      @error="onDatasetFinderError"
    />

    <!-- Publish Collection Dialog -->
    <publish-collection-dialog
      v-if="showPublishDialog"
      :collection-details="collection"
      @close="showPublishDialog = false"
    />

    <!-- Edit Collection Dialog -->
    <edit-collection-dialog
      v-if="showEditDialog"
      :collection-details="collection"
      @close="showEditDialog = false"
      @collection-updated="onCollectionUpdated"
    />
  </div>
</template>

<script>
import { useSendXhr } from '@/mixins/request/request_composable.js'
import { useGetToken } from '@/composables/useGetToken.js'
import * as siteConfig from '@/site-config/site.json'
import CollectionHeader from './CollectionHeader.vue'
import DatasetCardCollections from './DatasetCardCollections.vue'
import DatasetFinderDialog from './DatasetFinderDialog.vue'
import PublishCollectionDialog from './PublishCollectionDialog.vue'
import EditCollectionDialog from './EditCollectionDialog.vue'
import IconLink from '../../icons/IconLink.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: 'CollectionDetails',

  components: {
    BfButton,
    CollectionHeader,
    DatasetCardCollections,
    DatasetFinderDialog,
    PublishCollectionDialog,
    EditCollectionDialog,
    IconLink
  },

  props: {
    collectionId: {
      type: [String, Number],
      required: true
    }
  },

  data() {
    return {
      collection: null,
      datasetList: [],
      isLoading: false,
      showCopySuccess: false,
      showDatasetFinder: false,
      showPublishDialog: false,
      showEditDialog: false
    }
  },

  computed: {
    collectionDescription() {
      return this.collection?.description || ''
    },

    originallyPublishedDate() {
      const date = this.collection?.firstPublishedAt || this.collection?.createdAt
      return this.formatDate(date)
    },

    lastUpdatedDate() {
      const date = this.collection?.revisedAt || this.collection?.versionPublishedAt || this.collection?.updatedAt
      return this.formatDate(date)
    },

    datasetTags() {
      return this.collection?.tags || []
    },

    siteUrl() {
      return `${siteConfig.discoverAppUrl}/collections/${this.collection?.id || this.collectionId}`
    }
  },

  mounted() {
    this.getCollectionDetails()
  },

  watch: {
    collectionId() {
      this.getCollectionDetails()
    },

    showCopySuccess(newVal) {
      if (newVal) {
        setTimeout(() => {
          this.showCopySuccess = false
        }, 3000)
      }
    }
  },

  methods: {
    async getCollectionDetails() {
      this.isLoading = true
      
      try {
        const token = await useGetToken()
        const url = `${siteConfig.api2Url}/collections/${this.collectionId}`
        
        const response = await useSendXhr(url, {
          method: 'GET',
          header: {
            Authorization: `Bearer ${token}`
          }
        })

        if (response) {
          // Transform the response data to match our component structure
          this.collection = {
            id: response.nodeId || response.id,
            name: response.name,
            description: response.description,
            datasetCount: response.size || 0,
            banners: response.banners || [],
            state: response.state || 'private',
            publication: response.publication || null,
            doi: response.doi,
            ownerFirstName: response.ownerFirstName || '',
            ownerLastName: response.ownerLastName || '',
            ownerOrcid: response.ownerOrcid || '',
            revisedAt: response.revisedAt,
            versionPublishedAt: response.versionPublishedAt,
            firstPublishedAt: response.firstPublishedAt,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            tags: response.tags || []
          }

          // Get the datasets for this collection
          this.datasetList = response.datasets || []
        }
      } catch (error) {
        console.error('Error fetching collection details:', error)
        this.collection = null
      } finally {
        this.isLoading = false
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },

    onClickCopy() {
      navigator.clipboard.writeText(this.siteUrl)
      this.showCopySuccess = true
    },

    goToDatasets() {
      // Navigate to datasets - this would depend on your routing structure
      this.$router.push({ name: 'datasets' })
    },

    goToCollections() {
      this.$router.push({ name: 'my-collections' })
    },

    onDatasetsUpdated(changes) {
      console.log('Datasets updated in collection:', changes)
      // Refresh the collection details to show the updated datasets
      this.getCollectionDetails()
      
      // Show success message
      const { added, removed } = changes
      let message = ''
      
      if (added && added.length > 0 && removed && removed.length > 0) {
        message = `Successfully updated collection: added ${added.length} and removed ${removed.length} datasets`
      } else if (added && added.length > 0) {
        message = `Successfully added ${added.length} dataset${added.length !== 1 ? 's' : ''} to collection`
      } else if (removed && removed.length > 0) {
        message = `Successfully removed ${removed.length} dataset${removed.length !== 1 ? 's' : ''} from collection`
      }
      
      if (message) {
        console.log(message)
        // You could implement a toast notification here
      }
    },

    onDatasetFinderError(errorMessage) {
      console.error('Dataset finder error:', errorMessage)
      // You could implement a toast notification here
    },

    onCollectionUpdated(updatedCollection) {
      console.log('Collection updated:', updatedCollection)
      // Update the local collection data with the new values
      if (this.collection && updatedCollection) {
        this.collection.name = updatedCollection.name
        this.collection.description = updatedCollection.description
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.collection-details {
  background-color: #ffffff;
  overflow-x: hidden;
  padding: 32px;
}

.loading-state {
  padding: 40px;

  .loading-content {
    max-width: 1200px;
    margin: 0 auto;

    .loader-header {
      height: 40px;
      background: $gray_1;
      border-radius: 4px;
      margin-bottom: 16px;
      width: 60%;
      animation: pulse 2s infinite;
    }

    .loader-description {
      height: 20px;
      background: $gray_1;
      border-radius: 4px;
      margin-bottom: 32px;
      width: 80%;
      animation: pulse 2s infinite;
    }

    .loader-datasets {
      .loader-dataset {
        height: 120px;
        background: $gray_1;
        border-radius: 4px;
        margin-bottom: 16px;
        animation: pulse 2s infinite;
      }
    }
  }
}

//.collection-content {
//  .discover-content {
//    //max-width: 1200px;
//    //margin: 0 auto;
//    //padding: 0 40px;
//  }
//
//  .container-fluid {
//    width: 100%;
//  }
//}

.discover-content-title {
  color: $purple_1;
  font-size: 16px;
  font-weight: 500;
  line-height: 40px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 32px;
}

.datasets-list {
  .mb-16 {
    margin-bottom: 16px;
  }
}

.no-datasets {
  text-align: center;
  padding: 40px 20px;

  h5 {
    font-size: 16px;
    color: $gray_5;
    margin-bottom: 24px;
    font-weight: 500;
  }

  .btn-browse {
    background: $purple_1;
    color: $white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: $purple_2;
    }
  }
}

.dataset-info {
  background-color: $gray_1;
  border-top: 1px solid $gray_2;
  padding: 40px 0 64px;
  margin-top: 32px;

  .dataset-info-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
  }

  .row {
    width: 100%;
    margin-bottom: 24px;

    &.mb-24 {
      margin-bottom: 32px;
    }
  }

  .col-xs-12 {
    width: 100%;
  }

  h2 {
    color: $gray_6;
    font-size: 28px;
    font-weight: 600;
    line-height: 36px;
    margin: 0 0 32px;
  }

  h3 {
    color: $gray_5;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
    margin: 0 0 20px;
  }
}

.info-publishing-history {
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (min-width: 48em) {
    flex-direction: row;
    gap: 64px;
  }

  .info-text {
    color: $gray_5;
    font-size: 14px;
    line-height: 20px;

    .info-text-caps {
      text-transform: uppercase;
      color: $gray_4;
      font-size: 11px;
      font-weight: 600;
      line-height: 16px;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
  }
}

.share-collection {
  margin-top: 32px;
}

.info-icons {
  display: flex;
  align-items: center;

  .copy-button {
    background: $white;
    border: 1px solid $gray_3;
    cursor: pointer;
    padding: 10px 12px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;

    &:hover {
      background: $gray_1;
      border-color: $gray_4;
    }

    .icon-upload {
      color: $gray_5;
    }
  }

  .copy-success-notification {
    color: $green_1;
    margin-left: 12px;
    font-size: 14px;
    font-weight: 500;
  }
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .tag {
    background: $purple_tint;
    color: $purple_1;
    border: 1px solid rgba($purple_1, 0.2);
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: rgba($purple_1, 0.1);
      border-color: rgba($purple_1, 0.3);
    }
  }
}

.error-state {
  text-align: center;
  padding: 80px 20px;

  h3 {
    font-size: 24px;
    color: $gray_5;
    margin-bottom: 16px;
  }

  p {
    color: $gray_4;
    font-size: 16px;
    margin-bottom: 32px;
  }

  .btn-back {
    background: $purple_1;
    color: $white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: $purple_2;
    }
  }
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