<template>
  <div class="neuroglancer-placeholder">
    <div v-if="!isProcessing" class="empty-state">
      <svg class="placeholder-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" stroke-width="2" />
        <path d="M8 24h48" stroke="currentColor" stroke-width="2" />
        <circle cx="32" cy="38" r="8" stroke="currentColor" stroke-width="2" />
        <path d="M28 38l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>

      <h3 class="placeholder-title">No viewer assets available</h3>
      <p class="placeholder-description">
        This file can be processed for the Neuroglancer image viewer.
        Select your processing options and click the button below.
      </p>

      <div class="processing-options">
        <label class="option">
          <input v-model="downsample" type="checkbox" />
          <span>Downsample</span>
        </label>
        <label class="option">
          <input v-model="compress" type="checkbox" />
          <span>Compress</span>
        </label>
      </div>

      <button class="process-btn" @click="startProcessing">
        Process for Viewer
      </button>
    </div>

    <div v-else class="processing-state">
      <div class="spinner" />
      <h3 class="placeholder-title">Processing...</h3>
      <p class="placeholder-description">
        Your file is being processed for the Neuroglancer viewer.
        This may take a moment.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import {
  submitProcessForViewer,
  checkProcessingStatus,
} from '@/utils/mockImageProcessingApi'

const props = defineProps({
  pkg: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['assets-ready'])

const downsample = ref(true)
const compress = ref(true)
const isProcessing = ref(false)

let pollInterval = null

function startProcessing() {
  const packageId = props.pkg?.content?.id
  const datasetId = props.pkg?.content?.datasetNodeId
  if (!packageId) return

  isProcessing.value = true

  submitProcessForViewer({
    packageId,
    datasetId,
    options: { downsample: downsample.value, compress: compress.value },
  })

  pollInterval = setInterval(async () => {
    const result = await checkProcessingStatus(packageId)
    if (result.status === 'ready') {
      clearInterval(pollInterval)
      pollInterval = null
      emit('assets-ready', result.assets)
    }
  }, 3000)
}

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
})
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.neuroglancer-placeholder {
  align-items: center;
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 40px;
}

.empty-state,
.processing-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  max-width: 380px;
  text-align: center;
}

.placeholder-icon {
  color: theme.$gray_3;
  height: 64px;
  margin-bottom: 16px;
  width: 64px;
}

.placeholder-title {
  color: theme.$gray_6;
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px;
}

.placeholder-description {
  color: theme.$gray_4;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 24px;
}

.processing-options {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
}

.option {
  align-items: center;
  color: theme.$gray_5;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 6px;

  input[type="checkbox"] {
    accent-color: theme.$purple_2;
    cursor: pointer;
    margin: 0;
  }
}

.process-btn {
  background: theme.$purple_1;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 24px;
  transition: background 0.2s;

  &:hover {
    background: theme.$purple_2;
  }
}

.spinner {
  animation: spin 1s linear infinite;
  border: 3px solid theme.$gray_2;
  border-radius: 50%;
  border-top-color: theme.$purple_1;
  height: 40px;
  margin-bottom: 16px;
  width: 40px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
