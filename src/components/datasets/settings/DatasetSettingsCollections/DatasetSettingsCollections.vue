<template>
  <div class="dataset-settings-collections">
    <h4>Collection</h4>
    <p class="mb-16">
      Assign this dataset to a collection to group similar work
    </p>

    <el-select
      ref="inputCollection"
      v-model="inputCollection"
      class="mb-8"
      placeholder="Add or Create a Collection"
      filterable
      default-first-option
      allow-create
      :multiple="false"
      no-data-text="Start typing to create a new collection"
      :disabled="datasetLocked"
      popper-class="bf-menu dataset-collections-input-options"
      @change="onCollectionSelect"
    >
      <template #prefix>
        <IconResearch
          :height="20"
          :width="20"
          />
      </template>

      <el-option
        v-for="collection in unselectedCollections"
        :key="collection.id"
        class="filtered-field bf-menu-item"
        :label="collection.name"
        :value="collection"
      />
    </el-select>
    <p
      v-if="hasError"
      class="error mb-8"
    >
      Sorry, an error has occurred. Please try again.
    </p>

    <div class="tag-wrap">
      <bf-tag
        v-for="collection in datasetCollections"
        :key="collection.id"
        :label="collection.name"
        class="tag mb-8 mr-8"
        @remove="removeCollection({ datasetId: $route.params.datasetId, collectionId: collection.id })"
      />
    </div>
  </div>
</template>

<script>
import { useCollectionsStore } from '@/stores/collectionStore'

import BfTag from '../../../shared/BfTag/BfTag.vue'
import Request from '../../../../mixins/request'
import IconResearch from "../../../icons/IconResearch.vue";

export default {
  name: 'DatasetSettingsCollections',

  components: {
    IconResearch,
    BfTag
  },

  mixins: [
    Request
  ],

  setup() {
    const collectionsStore = useCollectionsStore()
    return {
      collectionsStore
    }
  },

  data() {
    return {
      inputCollection: null,
      hasError: false
    }
  },

  computed: {
    config() {
      return this.$store.state.config
    },
    
    datasetLocked() {
      return this.$store.state.datasetLocked
    },

    collections() {
      return this.collectionsStore.collections
    },
    
    datasetCollections() {
      return this.collectionsStore.datasetCollections
    },

    /**
     * Compute the collections that the dataset is not
     * already a part of
     * @returns {Array}
     */
    unselectedCollections: function() {
      return this.collections.filter(collection => {
        return !this.datasetCollections.find(item => item.id === collection.id)
      })
    }
  },

  async mounted() {
    await this.collectionsStore.getUserCollections()
    await this.collectionsStore.fetchDatasetCollections(this.$route.params.datasetId)
  },

  methods: {

    /**
     * Add collection to the dataset
     */
    onCollectionSelect: async function(collection) {
      this.hasError = false

      const isCreating = this.$refs.inputCollection.showNewOption
      if (isCreating) {
        try {
          await this.collectionsStore.createCollection({
            datasetId: this.$route.params.datasetId,
            collectionName: collection
          })
        } catch (error) {
          this.hasError = true
        }
      } else {
        try {
          await this.collectionsStore.addCollection({
            datasetId: this.$route.params.datasetId,
            collectionId: collection.id
          })
        } catch (error) {
          this.hasError = true
        }
      }

      this.inputCollection = ''
    },

    removeCollection(params) {
      this.collectionsStore.removeCollection(params).catch(() => {
        this.hasError = true
      })
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme';
@use '../../../../styles/element/select';

.el-select {
  width: 100%;
}
.tag-wrap {
  display: flex;
  flex-wrap: wrap;
}
.el-input__prefix {
  align-items: center;
  display: flex;
}
.error {
  color: theme.$error-color;
}

.dataset-collections-input-options {
  .el-select-dropdown__item:not(.filtered-field) {
    align-items: center;
    color: theme.$app-primary-color;
    display: flex;
    padding: 16px;
    text-decoration: underline;

    &:before {
      content: 'Create "'
    }
    &:after {
      content: '"'
    }

    &.selected {
      color: #fff
    }
  }
}
</style>
