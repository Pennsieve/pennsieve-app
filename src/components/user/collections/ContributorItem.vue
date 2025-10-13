<template>
  <div class="contributor-item" :class="{ 'has-orcid': hasOrcid }">
    <span class="contributor-name" @click="showOrcidInfo" v-if="hasOrcid">
      {{ displayName }}
    </span>
    <span v-else class="contributor-name">
      {{ displayName }}
    </span>
    
    <!-- Simple tooltip/popover for ORCID info -->
    <div v-if="showOrcidPopover && hasOrcid" class="orcid-popover" @click.stop>
      <div v-if="isLoadingOrcid" class="loading">
        Loading ORCID data...
      </div>
      <div v-else-if="isOrcidDataNotFound" class="error">
        ORCID iD Not Found
      </div>
      <div v-else-if="hasOrcidDataError" class="error">
        Sorry, an error has occurred.
      </div>
      <div v-else class="orcid-content">
        <h3>{{ orcidName || displayName }}</h3>
        <p v-if="orcidId">
          <strong>ORCID iD</strong>:
          <a v-if="orcidUri" :href="orcidUri" target="_blank">
            {{ orcidId }}
          </a>
          <span v-else>{{ orcidId }}</span>
        </p>
        <p v-if="lastEmploymentOrganizationName">
          <strong>Organization</strong>: {{ lastEmploymentOrganizationName }}
        </p>
        <p v-if="lastEmploymentRole">
          <strong>Title</strong>: {{ lastEmploymentRole }}
        </p>
      </div>
      <button class="close-popover" @click="hideOrcidInfo">×</button>
    </div>
    
    <!-- Backdrop to close popover -->
    <div v-if="showOrcidPopover" class="popover-backdrop" @click="hideOrcidInfo"></div>
  </div>
</template>

<script>
export default {
  name: 'ContributorItem',

  props: {
    contributor: {
      type: Object,
      default: () => ({})
    }
  },

  data() {
    return {
      isLoadingOrcid: false,
      isOrcidDataNotFound: false,
      hasOrcidDataError: false,
      orcidData: {},
      showOrcidPopover: false
    }
  },

  computed: {
    displayName() {
      const firstName = this.contributor?.firstName || ''
      const lastName = this.contributor?.lastName || ''
      const degree = this.contributor?.degree || ''
      
      let name = `${firstName} ${lastName}`.trim()
      if (degree) {
        name += `, ${degree}`
      }
      
      return name || 'Unknown Contributor'
    },

    orcidName() {
      if (this.orcidData?.person?.name) {
        const givenName = this.orcidData.person.name['given-names']?.value || ''
        const familyName = this.orcidData.person.name['family-name']?.value || ''
        return `${givenName} ${familyName}`.trim()
      }
      return ''
    },

    lastEmployment() {
      const employments = this.orcidData?.['activities-summary']?.employments?.['employment-summary']
      return employments && employments.length > 0 ? employments[0] : {}
    },

    lastEmploymentOrganizationName() {
      return this.lastEmployment?.organization?.name || ''
    },

    lastEmploymentRole() {
      return this.lastEmployment?.['role-title'] || ''
    },

    orcidId() {
      return this.contributor?.orcid || ''
    },

    orcidUri() {
      return this.orcidData?.['orcid-identifier']?.uri || ''
    },

    hasOrcid() {
      return Boolean(this.orcidId)
    }
  },

  methods: {
    showOrcidInfo() {
      if (!this.hasOrcid) return
      
      this.showOrcidPopover = true
      this.getOrcidData()
    },

    hideOrcidInfo() {
      this.showOrcidPopover = false
    },

    async getOrcidData() {
      if (!this.hasOrcid || Object.keys(this.orcidData).length > 0) {
        return
      }

      this.isLoadingOrcid = true
      this.isOrcidDataNotFound = false
      this.hasOrcidDataError = false

      try {
        const response = await fetch(`https://pub.orcid.org/v2.1/${this.orcidId}`, {
          headers: {
            'Content-type': 'application/json'
          }
        })

        if (response.status === 404) {
          this.isOrcidDataNotFound = true
        } else if (!response.ok) {
          this.hasOrcidDataError = true
        } else {
          const json = await response.json()
          this.orcidData = json
        }
      } catch (error) {
        console.error('Error fetching ORCID data:', error)
        this.hasOrcidDataError = true
      } finally {
        this.isLoadingOrcid = false
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.contributor-item {
  position: relative;
  display: inline-block;
}

.contributor-name {
  color: inherit;
  font-size: inherit;
  
  &.has-orcid {
    cursor: pointer;
    text-decoration: underline;
    
    &:hover {
      color: theme.$purple_1;
    }
  }
}

.has-orcid .contributor-name {
  text-decoration: underline;
  cursor: pointer;
}

.orcid-popover {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 300px;
  max-width: 400px;
  margin-top: 8px;

  .loading, .error {
    text-align: center;
    padding: 8px;
    color: theme.$gray_5;
  }

  .error {
    color: #dc3545;
  }

  .orcid-content {
    h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #000;
    }

    p {
      margin: 8px 0;
      font-size: 14px;
      line-height: 1.4;
      color: theme.$gray_6;

      strong {
        color: #000;
      }

      a {
        color: theme.$purple_1;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .close-popover {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: theme.$gray_4;
    line-height: 1;
    padding: 4px;

    &:hover {
      color: #000;
    }
  }
}

.popover-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
}

// Arrow for popover
.orcid-popover::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: theme.$gray_2;
}

.orcid-popover::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: white;
  margin-top: 1px;
}
</style>