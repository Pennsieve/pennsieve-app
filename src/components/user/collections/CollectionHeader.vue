<template>
  <div class="collection-header">
    <div class="row">
      <div class="col-xs-12 col-sm-6">
        <div class="collection-title-wrap">
          <h1 class="collection-title">
            {{ collectionTitle }}
          </h1>
        </div>

        <!-- Collection Authors -->
        <div v-if="collectionContributors && collectionContributors.length > 0" class="collection-authors">
          <div
            v-for="(contributor, idx) in collectionContributors"
            :key="`${contributor.firstName}-${contributor.lastName}-${contributor.orcid || idx}`"
            class="contributor-item-wrap"
          >
            <contributor-item :contributor="contributor" />
            <template v-if="idx < collectionContributors.length - 1">
              ,
            </template>
          </div>
        </div>

        <p class="collection-description">
          {{ collectionDescription }}
        </p>

        <div v-if="collectionOwner" class="collection-meta">
          <div class="collection-corresponding-contributor">
            <p>Corresponding Contributor:</p>
            <contributor-item :contributor="correspondingContributor" />
          </div>
        </div>
      </div>

      <div class="col-xs-12 col-sm-6 first-xs last-sm">
        <div class="header-image-section">
          <collections-banner-image
            :banners="collectionBanners"
            class="collection-image"
          />
        </div>
      </div>
    </div>

    <div class="header-stats-section">
      <div class="stats-container">
        <!-- Left side: Status information -->
        <div class="status-items">
          <div class="status-item">
            <IconFiles class="status-icon" :height="16" :width="16" />
            <span class="status-text">
              <template v-if="datasetCount > 0">
                <strong>{{ formatNumber(datasetCount) }}</strong> Datasets
              </template>
              <template v-else> No Datasets </template>
            </span>
          </div>
          <div v-if="license" class="status-item">
            <IconLicense />
            <span class="status-text">
              <strong>{{ abbreviatedLicense }}</strong>
            </span>
          </div>
          <div class="status-item">
            <div class="state-badge" :class="collectionState">
              {{ stateButtonText }}
            </div>
          </div>
          <div v-if="version" class="status-item">
            <div>
              <a :href="discoverLink" target="_blank">{{
                "Version " + version
              }}</a>
            </div>
          </div>
        </div>

        <!-- Right side: Action buttons -->
        <div class="action-buttons">
          <bf-button class="secondary" @click="openEditDialog">
            Edit Collection
          </bf-button>

          <bf-button class="secondary" @click="openDatasetFinder">
            Select Datasets
          </bf-button>

          <bf-button
            v-if="showPublishButton"
            class="primary"
            @click="publishCollection"
          >
            {{ publishButtonText }}
          </bf-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import CollectionsBannerImage from "./CollectionsBannerImage.vue";
import ContributorItem from "./ContributorItem.vue";
import IconArrowLeft from "../../icons/IconArrowLeft.vue";
import IconLicense from "../../icons/IconLicense.vue";
import IconFiles from "../../icons/IconFiles.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: "CollectionHeader",

  components: {
    BfButton,
    CollectionsBannerImage,
    ContributorItem,
    IconArrowLeft,
    IconFiles,
  },

  props: {
    collectionDetails: {
      type: Object,
      default: () => ({}),
    },
    collectionContributors: {
      type: Array,
      default: () => [],
    },
    lastUpdatedDate: {
      type: String,
      default: "",
    },
    collectionDescription: {
      type: String,
      default: "",
    },
  },

  computed: {
    ...mapState(["config"]),
    collectionTitle() {
      return this.collectionDetails?.name || "";
    },

    collectionBanners() {
      // Transform banner URLs to the format expected by CollectionsBannerImage
      const banners = this.collectionDetails?.banners || [];
      return banners.map((url) => ({ uri: url }));
    },

    datasetCount() {
      return this.collectionDetails?.datasetCount || 0;
    },

    collectionOwner() {
      const firstName = this.collectionDetails?.ownerFirstName || "";
      const lastName = this.collectionDetails?.ownerLastName || "";
      return `${firstName} ${lastName}`.trim();
    },
    license() {
      return this.collectionDetails?.license || "";
    },
    
    abbreviatedLicense() {
      const license = this.license;
      if (!license) return "";
      
      // Map full license names to their abbreviations
      const licenseAbbreviations = {
        'Community Data License Agreement – Permissive': 'CDLA-Permissive-1.0',
        'Community Data License Agreement – Sharing': 'CDLA-Sharing-1.0',
        'Open Data Commons Open Database': 'ODbL',
        'Open Data Commons Attribution': 'ODC-By',
        'Open Data Commons Public Domain Dedication and License': 'PDDL',
        'Creative Commons Zero 1.0 Universal': 'CC-0',
        'Creative Commons Attribution': 'CC-BY',
        'Creative Commons Attribution - ShareAlike': 'CC-BY-SA',
        'Creative Commons Attribution - NonCommercial-ShareAlike': 'CC-BY-NC-SA',
        'Apache 2.0': 'Apache-2.0',
        'GNU General Public License v3.0': 'GPL-3.0',
        'GNU Lesser General Public License': 'LGPL',
        'MIT': 'MIT',
        'Mozilla Public License 2.0': 'MPL-2.0'
      };
      
      return licenseAbbreviations[license] || license;
    },
    correspondingContributor() {
      return {
        firstName: this.collectionDetails?.ownerFirstName || "",
        lastName: this.collectionDetails?.ownerLastName || "",
        orcid: this.collectionDetails?.ownerOrcid || "",
      };
    },
    publicationData() {
      return this.collectionDetails?.publication?.publishedDataset;
    },
    version() {
      return this.publicationData?.version;
    },
    discoverLink() {
      const publicationStatus = this.collectionDetails?.publication?.status;

      if (!publicationStatus.toLowerCase() == "completed") {
        return "";
      }
      const pd = this.publicationData;

      if (pd?.id && pd?.version) {
        return this.config.environment === "prod"
          ? `https://discover.pennsieve.io/collections/${pd.id}/version/${pd.version}`
          : `https://discover.pennsieve.net/collections/${pd.id}/version/${pd.version}`;
      }
    },
    publishedDateText() {
      // Optional: show "Published on" in the header stats
      const iso = this.publishedDataset?.lastPublishedDate;
      if (!iso) return null;
      try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return iso;
      }
    },
    stateButtonText() {
      const publicationStatus = this.collectionDetails?.publication?.status;
      if (publicationStatus === "Draft") {
        return "Draft";
      } else if (publicationStatus === "Completed") {
        return "Published";
      }
      // Fallback to the old state field if publication status is not available
      const state = this.collectionDetails?.state || "private";
      return state.charAt(0).toUpperCase() + state.slice(1);
    },

    collectionState() {
      const publicationStatus = this.collectionDetails?.publication?.status;
      if (publicationStatus === "Draft") {
        return "draft";
      } else if (publicationStatus === "Completed") {
        return "published";
      }
    },
    showPublishButton() {
      // Show publish button for all collections
      const publicationStatus = this.collectionDetails?.publication?.status;
      return publicationStatus === "Draft" || publicationStatus === "Completed";
    },

    publishButtonText() {
      const publicationStatus = this.collectionDetails?.publication?.status;
      if (publicationStatus === "Completed") {
        return "Publish New Version";
      }
      return "Publish Collection";
    },
  },

  methods: {
    formatNumber(number) {
      if (!number) return "0";
      return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    },

    goToDatasets() {
      // Navigate to datasets - this would depend on your routing structure
      this.$router.push({ name: "datasets" });
    },

    openEditDialog() {
      this.$emit("open-edit-dialog");
    },

    openDatasetFinder() {
      this.$emit("open-dataset-finder");
    },

    publishCollection() {
      this.$emit("publish-collection");
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.collection-header {
  padding-top: 24px;

  .row {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 16px;

    &.mb-8 {
      margin-bottom: 8px;
    }
  }

  .col-xs-12 {
    width: 100%;
  }

  .col-sm-6 {
    @media (min-width: 48em) {
      width: 50%;
    }
  }

  .col-xs-6 {
    width: 50%;
  }

  .col-sm-3 {
    @media (min-width: 48em) {
      width: 25%;
    }
  }

  .first-xs {
    order: -1;
  }

  .last-sm {
    @media (min-width: 48em) {
      order: 1;
    }
  }
}

.header-link {
  color: theme.$purple_2;
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;

  &:hover,
  &:focus {
    color: theme.$purple_2;
    text-decoration: underline;
  }

  .header-link-icon {
    color: theme.$purple_2;
    height: 10px;
    width: 10px;
    margin-right: 8px;
  }
}

.collection-title-wrap {
  position: relative;

  .collection-title {
    font-size: 32px;
    color: #000;
    font-weight: bold;
    margin-bottom: 24px;
    line-height: 40px;
    word-break: break-word;

    @media (min-width: 48em) {
      margin-top: 32px;
    }
  }
}

.collection-description {
  color: #000;
  font-size: 16px;
  line-height: 24px;
  margin-bottom: 24px;
}

.collection-authors {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  color: theme.$gray_5;
  font-size: 14px;
  line-height: 24px;
  margin-bottom: 16px;
  
  .contributor-item-wrap {
    display: inline-flex;
    margin-right: 4px;
  }
}

.collection-owners {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  color: #404554;
  font-size: 14px;
  line-height: 24px;
  margin-bottom: 13px;

  .contributor-item-wrap {
    display: inline-flex;
    margin-right: 4px;
  }
}

.collection-meta {
  margin-bottom: 24px;
}

.collection-corresponding-contributor {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  font-size: 14px;
  color: #404554;

  p {
    margin: 0 8px 0 0;
    font-weight: 500;
  }
}

.header-image-section {
  display: flex;
  justify-content: center;

  .collection-image {
    height: 200px;
    width: 200px;

    @media (max-width: 48em) {
      height: 150px;
      width: 150px;
    }

    @media (min-width: 48em) {
      height: 250px;
      width: 250px;
    }
  }
}

.header-stats-section {
  border-top: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
  margin: 26px 0 10px;
  padding: 20px;
  background: rgba(theme.$gray_1, 0.3);
}

.stats-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.status-items {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    justify-content: center;
  }
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .status-icon {
    color: theme.$gray_4;
    flex-shrink: 0;
  }

  .status-text {
    font-size: 14px;
    color: theme.$gray_4;
    white-space: nowrap;

    strong {
      color: theme.$gray_6;
      font-weight: 600;
    }
  }
}

.state-badge {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.5px;
  border: 1px solid transparent;

  &.draft {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
    border-color: rgba(249, 115, 22, 0.2);
  }

  &.published {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.2);
  }

  &.public {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.2);
  }

  &.private {
    background: rgba(107, 114, 128, 0.1);
    color: #4b5563;
    border-color: rgba(107, 114, 128, 0.2);
  }

  &.embargoed {
    background: rgba(249, 115, 22, 0.1);
    color: #ea580c;
    border-color: rgba(249, 115, 22, 0.2);
  }
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    justify-content: center;
    width: 100%;
  }
}
</style>
