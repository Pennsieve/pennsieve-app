<template>
  <div class="my-collections">
    <div class="collections-header">
      <p class="page-description">
        Browse and manage your collections. Collections help organize and share related datasets.
      </p>
      
      <div class="header-actions">
        <div class="search-bar">
          <IconSearch :width="20" :height="20" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search collections..."
            class="search-input"
            @input="onSearch"
          />
        </div>
        
        <bf-button class="primary" @click="showCreateDialog">
          Create Collection
        </bf-button>
      </div>
    </div>

    <!-- Use the CollectionsList component -->
    <collections-list ref="collectionsList" :user="true" :search-query="searchQuery" />
    
    <!-- Create Collection Dialog -->
    <create-collection-dialog
      :dialog-visible="createDialogVisible"
      @close="hideCreateDialog"
      @created="onCollectionCreated"
    />
  </div>
</template>

<script>
import IconSearch from '../../icons/IconSearch.vue'
import CollectionsList from './CollectionsList.vue'
import CreateCollectionDialog from './CreateCollectionDialog.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue"

export default {
  name: 'MyCollections',

  components: {
    IconSearch,
    CollectionsList,
    CreateCollectionDialog,
    BfButton
  },

  data() {
    return {
      searchQuery: '',
      createDialogVisible: false
    }
  },

  methods: {
    onSearch() {
      // Search functionality is handled reactively through the searchQuery prop
    },

    showCreateDialog() {
      this.createDialogVisible = true
    },

    hideCreateDialog() {
      this.createDialogVisible = false
    },

    onCollectionCreated(collection) {
      // Add the new collection to the list without refetching all data
      if (this.$refs.collectionsList && this.$refs.collectionsList.addNewCollection) {
        this.$refs.collectionsList.addNewCollection(collection)
      } else if (this.$refs.collectionsList && this.$refs.collectionsList.getCollections) {
        // Fallback to refresh if addNewCollection is not available
        this.$refs.collectionsList.getCollections()
      }
      
      // Show success message
      this.$message.success(`Collection "${collection.name}" created successfully`)
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.my-collections {
  margin: 32px;
}

.collections-header {
  margin-bottom: 32px;

  .page-description {
    font-size: 16px;
    color: $gray_5;
    line-height: 1.6;
    margin: 0 0 24px 0;
    max-width: 800px;
  }

  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    .search-bar {
      position: relative;
      max-width: 400px;
      width: 100%;
      display: flex;
      align-items: center;

      .search-icon {
        position: absolute;
        left: 16px;
        color: $gray_4;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        padding: 10px 16px 10px 48px;
        border: 1px solid $gray_2;
        border-radius: 4px;
        font-size: 14px;
        background: white;
        transition: all 0.2s ease;
        
        &::placeholder {
          color: $gray_4;
        }
        
        &:focus {
          outline: none;
          border-color: $purple_2;
          box-shadow: 0 0 0 2px rgba(77, 98, 140, 0.1);
        }
      }
    }
  }
}

// Responsive design
@media (max-width: 768px) {
  .collections-header {
    .header-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      
      .search-bar {
        max-width: 100%;
      }
    }
  }
}
</style>