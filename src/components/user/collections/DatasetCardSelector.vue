<template>
  <div class="dataset-card-selector" :class="{ selected: isSelected }" @click="toggleSelection">
    <div class="selection-checkbox">
      <input
        type="checkbox"
        :checked="isSelected"
        @click.stop="toggleSelection"
      />
    </div>
    
    <div class="dataset-card">
      <div class="dataset-content">
        <div class="image mr-16">
          <dataset-banner-image :src="dataset.banner" />
        </div>
        <div class="dataset-content-wrap">
          <div>
            <h3>
              {{ dataset.name }}
            </h3>
          </div>

          <div class="subtitle">
            {{ dataset.description }}
          </div>
          <div class="dataset-details-wrap mt-16">
            <div class="details">
              <div class="detail">
                <icon-files :height="16" :width="16"/>
                <span v-if="dataset.fileCount > 0 && dataset.fileCount !== 1">
                  <strong>{{ formatNumber(dataset.fileCount) }}</strong> Files
                </span>
                <span v-else-if="dataset.fileCount === 1">
                  <strong>{{ dataset.fileCount }}</strong> File
                </span>
                <span v-else>No Files</span>
              </div>
              <div class="detail">
                <icon-storage :height="16" :width="16"/>
                <strong>{{ formatSize(dataset.size) }}</strong>
              </div>
              <div class="detail">
                <icon-document :height="16" :width="16"/>
                <span v-if="dataset.recordCount > 0 && dataset.recordCount !== 1">
                  <strong>{{ formatNumber(dataset.recordCount) }}</strong> Records
                </span>
                <span v-else-if="dataset.recordCount === 1">
                  <strong>{{ dataset.recordCount }}</strong> Record
                </span>
                <span v-else>No Records</span>
              </div>
              <div class="detail">
                <icon-license :height="16" :width="16"/>
                <span v-if="dataset.license === ''">No License</span>
                <span v-else>{{ getLicenseAbbr(dataset.license) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="meta">
        <div class="author">
          <strong>{{ datasetOwnerName }}</strong>
          updated on {{ lastUpdatedDate }}
        </div>
        <div v-if="dataset.tags && dataset.tags.length > 0" class="tags">
          <strong>{{ firstThreeTags.join(', ') }}</strong>
          <span v-if="dataset.tags.length > 3">
            +{{ dataset.tags.length - 3 }} More
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DatasetBannerImage from './DatasetBannerImage.vue'
import IconFiles from '../../icons/IconFiles.vue'
import IconStorage from '../../icons/IconStorage.vue'
import IconDocument from '../../icons/IconDocument.vue'
import IconLicense from '../../icons/IconLicense.vue'

export default {
  name: 'DatasetCardSelector',

  components: {
    DatasetBannerImage,
    IconFiles,
    IconStorage,
    IconDocument,
    IconLicense
  },

  props: {
    dataset: {
      type: Object,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    datasetOwnerName() {
      return this.dataset.owner || 'Unknown'
    },

    lastUpdatedDate() {
      const date = this.dataset.updatedAt || this.dataset.revisedAt || this.dataset.versionPublishedAt
      return this.formatDate(date)
    },

    firstThreeTags() {
      const tags = this.dataset.tags || []
      return tags.slice(0, 3)
    }
  },

  methods: {
    toggleSelection() {
      this.$emit('toggle-selection', this.dataset)
    },

    formatNumber(number) {
      if (!number) return '0'
      return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
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

    getLicenseAbbr(license) {
      if (!license) return 'No License'
      
      const abbreviations = {
        'Creative Commons Attribution': 'CC BY',
        'Creative Commons Attribution-ShareAlike': 'CC BY-SA',
        'Creative Commons Attribution-NonCommercial': 'CC BY-NC',
        'Creative Commons Attribution-NonCommercial-ShareAlike': 'CC BY-NC-SA',
        'Creative Commons Attribution-NoDerivs': 'CC BY-ND',
        'Creative Commons Attribution-NonCommercial-NoDerivs': 'CC BY-NC-ND',
        'MIT License': 'MIT',
        'Apache License 2.0': 'Apache 2.0'
      }
      
      return abbreviations[license] || license
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../styles/_theme.scss';

.dataset-card-selector {
  position: relative;
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    //box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    .dataset-card {
      border-color: $purple_1;
      box-shadow: 0 0 0 2px rgba(77, 98, 140, 0.2);
    }
  }

  .selection-checkbox {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
    
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
  }
}

.dataset-card {
  border: solid 1px $gray_3;
  border-radius: 3px;
  box-shadow: 1px 2px 2px $gray_2;
  background: white;
  margin-left: 40px;
  transition: all 0.2s ease;
}

.dataset-content-wrap {
  flex: 1;
}

h3 {
  color: #2760ff;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 8px;
  word-break: break-word;
}

.subtitle {
  color: #000;
  font-size: 14px;
  font-weight: normal;
  line-height: 24px;
  margin-bottom: 16px;
}

.dataset-details-wrap {
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
  margin-bottom: 11px;
  
  @media (min-width: 992px) {
    margin-bottom: 0;
  }
  
  .detail {
    align-items: center;
    display: flex;
    padding-right: 24px;
    color: #404554;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0px;
    line-height: 16px;
    
    svg {
      margin-right: 8px;
    }
  }
}

.dataset-content {
  display: flex;
  flex-direction: row;
  padding: 24px 16px;

  .image {
    margin-right: 16px;
    width: 86px;
    height: 86px;
    flex-shrink: 0;
    
    img {
      display: block;
      width: 86px;
      height: 86px;
      border-radius: 4px;
      object-fit: cover;
    }
  }
}

.meta {
  border-top: solid 1px $gray_3;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 16px;
  background-image: linear-gradient(90deg, $white, rgba(77, 98, 140, 0.05));

  .author {
    font-size: 12px;
    line-height: 14px;
  }
  
  .tags {
    font-size: 12px;
    line-height: 14px;
  }
}

.mt-16 {
  margin-top: 16px;
}

.mr-16 {
  margin-right: 16px;
}
</style>