<template>
  <div class="dataset-card">
    <div class="dataset-content">
      <div class="image mr-16">
        <dataset-banner-image :src="dataset.banner" />
      </div>
      <div class="dataset-content-wrap">
        <h3>
          <a :href="datasetUrl" target="_blank">
            {{ dataset.name }}
          </a>
        </h3>

        <div class="subtitle">
          {{ dataset.description }}
        </div>
        
        <div class="dataset-details-wrap mt-16">
          <div class="details">
            <div class="detail">
              <IconLicense :height="16" :width="16"/>
              <span v-if="dataset.license === '' || !dataset.license">No License</span>
              <span v-else :title="dataset.license">{{ licenseAbbreviation }}</span>
            </div>
            <div v-if="dataset.doi" class="detail">
              <IconDocument :height="16" :width="16"/>
              <span><strong>DOI: {{ dataset.doi }}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="meta">
      <div v-if="!dataset.embargo" class="author">
        <strong>{{ datasetOwnerName }}</strong>
        updated on {{ lastUpdatedDate }}
      </div>
      <div v-else class="author">
        <strong>Dataset will be released on</strong> {{ getEmbargoReleaseDate }}
      </div>
      
      <div v-if="dataset.tags && dataset.tags.length > 0" class="tags">
        <span v-if="dataset.tags.length > 3">
          <strong>{{ firstThreeTags.join(', ') }}</strong>
          +{{ dataset.tags.length - 3 }} More
        </span>
        <span v-else>
          <strong>{{ dataset.tags.join(', ') }}</strong>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import * as siteConfig from '@/site-config/site.json'
import DatasetBannerImage from './DatasetBannerImage.vue'
import IconLicense from '../../icons/IconLicense.vue'
import IconDocument from '../../icons/IconDocument.vue'

export default {
  name: 'DatasetCardCollections',

  components: {
    DatasetBannerImage,
    IconLicense,
    IconDocument
  },

  props: {
    dataset: {
      type: Object,
      default: () => ({
        arn: "",
        banner: "",
        contributors: [],
        createdAt: "",
        description: "",
        doi: "",
        type: "",
        embargo: false,
        embargoReleaseDate: null,
        fileCount: null,
        firstPublishedAt: "",
        id: null,
        license: "",
        modelCount: [],
        name: "",
        organizationName: "",
        ownerFirstName: "",
        ownerLastName: "",
        ownerOrcid: "",
        readme: "",
        recordCount: null,
        revisedAt: "",
        size: null,
        status: "",
        sponsorship: "",
        tags: [],
        updatedAt: "",
        uri: "",
        version: null,
        versionPublishedAt: ""
      })
    }
  },

  computed: {
    datasetUrl() {
      // Link to the discover app for viewing the dataset
      return `${siteConfig.discoverAppUrl}/datasets/${this.dataset.id}`
    },

    getEmbargoReleaseDate() {
      return this.formatDate(this.dataset.embargoReleaseDate)
    },

    firstThreeTags() {
      const tags = this.dataset.tags || []
      return tags.slice(0, 3)
    },

    licenseAbbreviation() {
      const license = this.dataset.license || ''
      return this.getLicenseAbbr(license)
    },

    datasetOwnerName() {
      const firstName = this.dataset.ownerFirstName || ''
      const lastName = this.dataset.ownerLastName || ''
      return `${firstName} ${lastName}`.trim() || 'Unknown'
    },

    lastUpdatedDate() {
      const date = this.dataset.revisedAt || this.dataset.versionPublishedAt
      return this.formatDate(date)
    }
  },

  methods: {
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

    getLicenseAbbr(license) {
      if (!license) return 'No License'
      
      // Common license abbreviations
      const licenseMap = {
        'Creative Commons Attribution': 'CC BY',
        'Creative Commons Attribution 4.0 International': 'CC BY 4.0',
        'Creative Commons Attribution-ShareAlike': 'CC BY-SA',
        'Creative Commons Attribution-ShareAlike 4.0 International': 'CC BY-SA 4.0',
        'Creative Commons Attribution-NonCommercial': 'CC BY-NC',
        'Creative Commons Attribution-NonCommercial 4.0 International': 'CC BY-NC 4.0',
        'Creative Commons Attribution-NonCommercial-ShareAlike': 'CC BY-NC-SA',
        'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International': 'CC BY-NC-SA 4.0',
        'Creative Commons Attribution-NoDerivatives': 'CC BY-ND',
        'Creative Commons Attribution-NoDerivatives 4.0 International': 'CC BY-ND 4.0',
        'MIT License': 'MIT',
        'Apache License 2.0': 'Apache 2.0',
        'GNU General Public License v3.0': 'GPL v3.0',
        'BSD 3-Clause License': 'BSD 3-Clause'
      }
      
      return licenseMap[license] || license
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.dataset-card {
  border: solid 1px $gray_2;
  border-radius: 3px 3px 0 0;
  background: white;
}

.dataset-content {
  display: flex;
  flex-direction: row;
  padding: 24px 16px;

  .image {
    margin-right: 16px;
  }
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

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &:focus {
      color: #1c46bd;
    }
  }
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

.meta {
  border-top: solid 1px $gray_2;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 16px;

  .author {
    font-size: 12px;
    line-height: 14px;
    color: $gray_5;
  }

  .tags {
    font-size: 12px;
    line-height: 14px;
    color: $gray_5;
    text-align: right;
  }
}

.mr-16 {
  margin-right: 16px;
}

.mt-16 {
  margin-top: 16px;
}
</style>