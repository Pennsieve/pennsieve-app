<script setup>

import {onMounted, onUnmounted, watch} from "vue";
import {useStore} from "vuex";
import {useRouter, useRoute} from "vue-router";
import {useMetadataStore} from '@/stores/metadataStore.js'
import RelationshipCreationWidget from '@/components/datasets/metadata/shared/RelationshipCreationWidget.vue'

const props = defineProps({
  orgId: {
    type: String,
    default: ''
  }
})

const store = useStore()
const router = useRouter()
const route = useRoute()
const metadataStore = useMetadataStore()

// Watch for navigation away from metadata routes
const cancelIfLeavingMetadata = () => {
  // Check if we're navigating away from metadata routes
  if (!route.path.includes('/metadata')) {
    // Cancel any active relationship creation
    if (metadataStore.activeRelationshipCreation) {
      console.log('Canceling relationship creation - navigating away from metadata')
      metadataStore.cancelRelationshipCreation()
    }
  }
}

// Set up route watcher
watch(() => route.path, (newPath, oldPath) => {
  // If we're leaving a metadata route
  if (oldPath?.includes('/metadata') && !newPath?.includes('/metadata')) {
    // Cancel any active relationship creation
    if (metadataStore.activeRelationshipCreation) {
      console.log('Canceling relationship creation - left metadata section')
      metadataStore.cancelRelationshipCreation()
    }
    // Note: PackageAttachmentWidget is now handled at the Datasets component level
    // so we don't cancel package attachment here anymore
  }
})

// Clean up when component unmounts (navigating away)
onUnmounted(() => {
  // Cancel any active relationship creation when leaving metadata view entirely
  if (metadataStore.activeRelationshipCreation) {
    console.log('Canceling relationship creation - unmounting metadata view')
    metadataStore.cancelRelationshipCreation()
  }
  // Note: PackageAttachmentWidget is now handled at the Datasets component level
  // so we don't cancel package attachment here anymore
})

// Always load the models when in this scenario
onMounted(async () => {
  // try {
  //   store.dispatch('metadataModule/fetchModels')
  // } catch (err) {
  //   console.error(err);
  // }
})

</script>


<template>
  <div class="dataset-metadata-view">
    <router-view name="stage" />
    <RelationshipCreationWidget />
  </div>
</template>

