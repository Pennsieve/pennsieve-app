<template>
  <div class="collections-card" @click="navigateToCollection">
    <div class="collections-content">
      <div class="collection-info">
        <div class="collection-status">
          {{ collectionState }}
        </div>
        
        <div class="collection-title-wrapper">
          <h3 class="collection-title">
            {{ collection.name }}
          </h3>
        </div>
        
        <p class="collection-description">
          {{ collection.description }}
        </p>
        
        <div class="collections-details-wrap">
          <div class="details">
            <div class="detail">
              <IconFiles :height="14" :width="14" class="detail-icon" />
              <span class="detail-label">Datasets:</span>
              <span class="detail-value">{{ formatNumber(collection.datasetCount) }}</span>
            </div>
            <div v-if="collection.state === 'public' && collection.doi" class="detail">
              <IconLicense :height="14" :width="14" class="detail-icon" />
              <span class="detail-label">DOI:</span>
              <span class="detail-value">{{ collection.doi }}</span>
            </div>
            <div v-if="collection.tags && collection.tags.length > 0" class="detail">
              <IconTag :height="14" :width="14" class="detail-icon" />
              <span class="detail-label">Tags:</span>
              <span class="detail-value">{{ collection.tags.join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="collection-banner" v-if="collectionBanners.length > 0">
        <collections-banner-image :banners="collectionBanners" />
      </div>
    </div>
  </div>
</template>

<script>
import CollectionsBannerImage from './CollectionsBannerImage.vue'
import IconFiles from '../../icons/IconFiles.vue'
import IconTag from '../../icons/IconTag.vue'
import IconLicense from '../../icons/IconLicense.vue'
import * as siteConfig from '@/site-config/site.json'

export default {
  name: 'CollectionsCard',

  components: {
    CollectionsBannerImage,
    IconFiles,
    IconTag,
    IconLicense
  },

  props: {
    collection: {
      type: Object,
      required: true,
      default: () => ({
        id: null,
        name: '',
        description: '',
        datasetCount: 0,
        userRole: '',
        banners: [],
        state: 'private',
        doi: '',
        ownerFirstName: '',
        ownerLastName: '',
        revisedAt: '',
        versionPublishedAt: ''
      })
    }
  },

  computed: {
    collectionOwnerName() {
      const firstName = this.collection.ownerFirstName || ''
      const lastName = this.collection.ownerLastName || ''
      const fullName = `${firstName} ${lastName}`.trim()
      return fullName || 'Unknown'
    },

    collectionBanners() {
      // Transform banner URLs to the format expected by CollectionsBannerImage
      const banners = this.collection.banners || []
      return banners.map(url => ({ uri: url }))
    },

    collectionState() {
      const state = this.collection.state || 'private'
      if (state === 'completed') {
        return 'Published'
      }
      return state.charAt(0).toUpperCase() + state.slice(1)
    },

    collectionUrl() {
      // Link to the discover app for viewing the collection
      return `${siteConfig.discoverAppUrl}/collections/${this.collection.id}`
    },

    lastUpdatedDate() {
      const date = this.collection.revisedAt || this.collection.versionPublishedAt
      if (!date) return 'Unknown'
      
      // Simple date formatting - you could use a more sophisticated date library
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  },

  methods: {
    formatNumber(number) {
      if (!number) return '0'
      return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
    },

    navigateToCollection() {
      this.$router.push({
        name: 'collection-details',
        params: {
          collectionId: this.collection.id
        }
      })
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.collections-card {
  border-bottom: 1px solid theme.$gray_2;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: theme.$gray_1;
  }

  &:first-child {
    border-top: none;
  }

  &:last-child {
    border-bottom: none;
  }
}

.collections-content {
  display: flex;
  align-items: center;
  padding: 24px;
  gap: 24px;

  .image {
    margin-right: 0;
  }
}

.collection-info {
  flex: 1;
}

.collection-banner {
  flex-shrink: 0;
}

.collection-status {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: theme.$purple_1;
}

.collection-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.collection-title {
  font-size: 18px;
  font-weight: 500;
  color: theme.$purple_3;
  margin: 0;
}

.collection-description {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0 0 16px 0;
  max-width: 600px;
}

.collections-details-wrap {
  display: flex;
  flex-direction: column;
  
  @media (min-width: 992px) {
    align-items: flex-end;
    flex-direction: row;
  }
}

.details {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-start;
  margin-bottom: 0;
  gap: 24px;

  .detail {
    align-items: center;
    display: flex;
    gap: 6px;
    font-size: 13px;
    line-height: 16px;

    .detail-icon {
      color: theme.$gray_4;
      flex-shrink: 0;
    }

    .detail-label {
      color: theme.$gray_4;
      font-weight: 500;
    }

    .detail-value {
      color: theme.$gray_6;
    }
    
    // Special styling for tags (when it's the third detail item)
    &:nth-child(3) .detail-value {
      font-style: italic;
      color: theme.$purple_2;
    }
  }
}


// Responsive design
@media (max-width: 768px) {
  .collections-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .collection-description {
    max-width: none;
  }
}

</style>