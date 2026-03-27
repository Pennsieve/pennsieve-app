<template>
  <div class="nii-container">
    <NiiViewer
      v-if="url"
      :url="url"
      :zarr-level="zarrLevel"
    />
    <p v-else-if="needsConversion" class="nii-message">
      File too large for direct viewing ({{ fileSizeMB }}MB). Run a conversion workflow first.
    </p>
    <p v-else-if="error" class="nii-message nii-error">{{ error }}</p>
    <div v-else-if="loading" class="nii-message">Loading...</div>
  </div>
</template>

<script setup>
import { NiiViewer, useNiiSource } from '@pennsieve-viz/core'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

const props = defineProps({
  pkg: {
    type: Object,
    default: () => ({})
  }
})

const { url, zarrLevel, needsConversion, fileSizeMB, error, loading } = useNiiSource({
  pkgId: props.pkg?.content?.id ?? '',
  apiUrl: siteConfig.apiUrl,
  getToken: useGetToken,
})
</script>

<style scoped>
.nii-container {
  height: 90vh;
  position: relative;
}

.nii-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #546085;
  font-size: 14px;
}

.nii-error {
  color: #d32f2f;
}
</style>
