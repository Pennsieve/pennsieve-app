<template>
  <div class="collections-card">
    <div class="collections-content">
      <div class="image mr-16">
        <collections-banner-image :banners="collectionBanners" />
      </div>
      <div class="collection-content-wrap">
        <div class="collection-header">
          <h3>
            <router-link
              :to="{
                name: 'collection-details',
                params: { collectionId: collection.id },
              }"
            >
              {{ collection.name }}
            </router-link>
          </h3>
          <div class="collection-state-tag">
            {{ collectionState }}
          </div>
        </div>
        <div class="subtitle">
          {{ collection.description }}
        </div>
        <div class="collections-details-wrap">
          <div class="details">
            <div class="detail">
              <IconDataset :height="16" :width="16" />
              <span
                v-if="
                  collection.datasetCount > 0 && collection.datasetCount !== 1
                "
              >
                <strong>{{ formatNumber(collection.datasetCount) }}</strong>
                Datasets
              </span>
              <span v-else-if="collection.datasetCount === 1">
                <strong>{{ collection.datasetCount }}</strong> Dataset
              </span>
              <span v-else>No Datasets</span>
            </div>
            <div class="detail">
              <IconLicense />
              <span>
                <strong>{{ collection.license }}</strong>
              </span>
            </div>
            <div
              v-if="collection.state === 'public' && collection.doi"
              class="detail"
            >
              <IconStorage :height="16" :width="16" />
              <span>
                <strong>DOI: {{ collection.doi }}</strong>
              </span>
            </div>
            <div class="detail tags">
              <span>
                <strong>{{ formatTags(collection.tags) }}</strong>
              </span>
            </div>
            <!--            <div class="detail">-->
            <!--              <span>{{ collectionOwnerName }}</span>-->
            <!--            </div>-->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CollectionsBannerImage from "./CollectionsBannerImage.vue";
import IconDataset from "../../icons/IconDataset.vue";
import IconLicense from "../../icons/IconLicense.vue";
import IconStorage from "../../icons/IconStorage.vue";
import * as siteConfig from "@/site-config/site.json";

export default {
  name: "CollectionsCard",

  components: {
    CollectionsBannerImage,
    IconDataset,
    IconStorage,
  },

  props: {
    collection: {
      type: Object,
      required: true,
      default: () => ({
        id: null,
        name: "",
        description: "",
        datasetCount: 0,
        userRole: "",
        banners: [],
        state: "private",
        doi: "",
        ownerFirstName: "",
        ownerLastName: "",
        revisedAt: "",
        versionPublishedAt: "",
        tags: [],
      }),
    },
  },

  computed: {
    collectionOwnerName() {
      const firstName = this.collection.ownerFirstName || "";
      const lastName = this.collection.ownerLastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || "Unknown";
    },

    collectionBanners() {
      // Transform banner URLs to the format expected by CollectionsBannerImage
      const banners = this.collection.banners || [];
      return banners.map((url) => ({ uri: url }));
    },

    collectionState() {
      const state = this.collection.state || "private";
      if (state.toLowerCase() === "completed") {
        return "Published";
      }
      return state.charAt(0).toUpperCase() + state.slice(1);
    },

    collectionUrl() {
      // Link to the discover app for viewing the collection
      return `${siteConfig.discoverAppUrl}/collections/${this.collection.id}`;
    },

    lastUpdatedDate() {
      const date =
        this.collection.revisedAt || this.collection.versionPublishedAt;
      if (!date) return "Unknown";

      // Simple date formatting - you could use a more sophisticated date library
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },

  methods: {
    formatNumber(number) {
      if (!number) return "0";
      return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    },
    formatTags(tags) {
      return (tags || []).join(", ");
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.collections-card {
  border: solid 1px theme.$gray_2;
  border-radius: 3px 3px 0 0;
}

.collections-content {
  display: flex;
  flex-direction: row;
  padding: 16px;

  .image {
    margin-right: 16px;
  }
}

.collection-content-wrap {
  flex: 1;
}

.collection-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

h3 {
  color: #2760ff;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
  word-break: break-word;
  flex: 1;
  margin-right: 16px;

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
.tags {
  margin-left: auto;
  padding-right: 0px !important;
}
.collection-state-tag {
  background: theme.$purple_tint;
  color: theme.$purple_1;
  border: 1px solid rgba(theme.$purple_1, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.subtitle {
  color: #000;
  font-size: 14px;
  font-weight: normal;
  line-height: 20px;
  margin-bottom: 12px;
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
  background-image: linear-gradient(90deg, #fff, #e6e9ef);
  border-top: 1px solid #ccc;
  padding: 8px 16px;
  border-radius: 2px;
  .detail {
    align-items: center;
    display: flex;
    padding-right: 20px;
    color: #404554;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 16px;

    svg {
      margin-right: 6px;
    }
  }
}

.mr-16 {
  margin-right: 16px;
}
</style>
