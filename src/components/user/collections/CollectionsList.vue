<template>
  <div class="collections-list">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <p>Loading collections...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="getCollections" class="retry-button">
        Try Again
      </button>
    </div>

    <!-- Collections grid -->
    <div v-else-if="collections.length > 0" class="collections-section">
      <div class="collections-grid">
        <collections-card
          v-for="collection in collections"
          :key="collection.id"
          :collection="collection"
          class="collection-item"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-content">
        <div class="empty-icon">
          <IconCollection :width="64" :height="64" color="#cbd5e0" />
        </div>
        <h2>No Collections Found</h2>
        <p v-if="searchQuery">
          No collections match your search for "{{ searchQuery }}". Try adjusting your search terms.
        </p>
        <p v-else>
          You don't have any collections yet. Collections help organize and share related datasets.
        </p>
        <button v-if="!searchQuery" class="btn-create" @click="createCollection">
          Create Your First Collection
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useSendXhr } from '@/mixins/request/request_composable.js'
import { useGetToken } from '@/composables/useGetToken.js'
import * as siteConfig from '@/site-config/site.json'
import CollectionsCard from './CollectionsCard.vue'
import IconCollection from '../../icons/IconCollection.vue'

export default {
  name: 'CollectionsList',

  components: {
    CollectionsCard,
    IconCollection
  },

  props: {
    user: {
      type: Boolean,
      default: false
    },
    searchQuery: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      collections: [],
      allCollections: [],
      isLoading: false,
      error: '',
      offset: 0,
      pageSize: 25,
      page: 1,
      totalCollectionsCount: 0
    }
  },

  mounted() {
    this.getCollections()
  },

  watch: {
    searchQuery(newQuery) {
      this.filterCollections(newQuery)
    }
  },

  methods: {
    async getCollections() {
      this.isLoading = true
      this.error = ''
      
      try {
        const token = await useGetToken()
        const url = `${siteConfig.api2Url}/collections/`
        
        const response = await useSendXhr(url, {
          method: 'GET',
          header: {
              Authorization: `Bearer ${token}`
          }
        })

        // Transform the response data to match our component structure
        if (response && response.collections) {
          this.allCollections = response.collections.map(item => ({
            id: item.nodeId,
            name: item.name,
            description: item.description || '',
            datasetCount: item.size || 0,
            userRole: item.userRole,
            banners: item.banners || [], // Dataset banner URLs from API
            state: item.publication?.status?.toLowerCase() || 'draft',
            doi: item.doi,
            ownerFirstName: item.ownerFirstName || '',
            ownerLastName: item.ownerLastName || '',
            revisedAt: item.revisedAt,
            versionPublishedAt: item.versionPublishedAt
          }))
          
          // Apply initial filter if search query exists
          this.filterCollections(this.searchQuery)
          this.totalCollectionsCount = response.totalCount || this.allCollections.length
        }
      } catch (err) {
        console.error('Error fetching collections:', err)
        this.error = 'Failed to load collections. Please try again.'
        this.collections = []
        this.allCollections = []
      } finally {
        this.isLoading = false
      }
    },

    filterCollections(query) {
      if (!query || query.trim() === '') {
        this.collections = [...this.allCollections]
        return
      }

      const searchTerm = query.toLowerCase().trim()
      this.collections = this.allCollections.filter(collection => {
        return (
          collection.name.toLowerCase().includes(searchTerm) ||
          collection.description.toLowerCase().includes(searchTerm) ||
          `${collection.ownerFirstName} ${collection.ownerLastName}`.toLowerCase().includes(searchTerm)
        )
      })
    },

    createCollection() {
      // Placeholder for create collection functionality
      console.log('Creating new collection')
      // This could navigate to a create collection page or open a modal
    },

    addNewCollection(collection) {
      // Transform the new collection to match our component structure
      const transformedCollection = {
        id: collection.nodeId,
        name: collection.name,
        description: collection.description || '',
        datasetCount: collection.size || 0,
        userRole: collection.userRole || 'Owner',
        banners: collection.banners || [],
        state: collection.state || 'private',
        doi: collection.doi,
        ownerFirstName: collection.ownerFirstName || '',
        ownerLastName: collection.ownerLastName || '',
        revisedAt: collection.revisedAt,
        versionPublishedAt: collection.versionPublishedAt
      }
      
      // Add to both arrays
      this.allCollections.unshift(transformedCollection)
      
      // Re-apply the current filter to include the new collection if it matches
      this.filterCollections(this.searchQuery)
      
      // Update total count
      this.totalCollectionsCount += 1
    }
  },

  // Expose methods for parent components
  expose: ['getCollections', 'addNewCollection']
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.collections-list {
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .loading-spinner {
    margin-bottom: 16px;
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid theme.$gray_2;
      border-top: 4px solid theme.$purple_2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
  
  p {
    color: theme.$gray_5;
    font-size: 16px;
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .error-message {
    color: theme.$red_1;
    font-size: 16px;
    margin-bottom: 16px;
    text-align: center;
  }
  
  .retry-button {
    padding: 8px 16px;
    background: theme.$purple_2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s ease;
    
    &:hover {
      background: theme.$purple_3;
    }
  }
}

.collections-section {
  .collections-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .collection-item {
      width: 100%;
    }
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .empty-content {
    text-align: center;
    max-width: 500px;
    
    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    
    h2 {
      font-size: 24px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 16px 0;
    }
    
    p {
      font-size: 16px;
      color: theme.$gray_5;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    
    .btn-create {
      background: theme.$purple_2;
      color: theme.$white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: theme.$purple_3;
      }
    }
  }
}

// Animation for spinner
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>