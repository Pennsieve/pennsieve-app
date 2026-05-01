<template>
  <div v-if="hasEligibleFiles" class="image-processing-options">
    <label class="processing-toggle">
      <input
        type="checkbox"
        :checked="imageProcessing.enabled"
        @change="toggle('enabled', $event.target.checked)"
      />
      <span>
        Process for Image Viewer
        <span class="eligible-count">({{ eligibleCount }} eligible {{ eligibleCount === 1 ? 'file' : 'files' }})</span>
      </span>
    </label>

    <div v-if="imageProcessing.enabled" class="sub-options">
      <label class="processing-option">
        <input
          type="checkbox"
          :checked="imageProcessing.downsample"
          @change="toggle('downsample', $event.target.checked)"
        />
        <span>Downsample</span>
      </label>
      <label class="processing-option">
        <input
          type="checkbox"
          :checked="imageProcessing.compress"
          @change="toggle('compress', $event.target.checked)"
        />
        <span>Compress</span>
      </label>
      <label class="processing-option">
        <input
          type="checkbox"
          :checked="imageProcessing.processAll"
          @change="toggle('processAll', $event.target.checked)"
        />
        <span>Process all relevant files</span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { isImageViewerEligible } from '@/utils/imageViewerFileTypes'

const store = useStore()

const uploadFiles = computed(() =>
  store.getters['uploadModule/getManifestFiles']()
)

const imageProcessing = computed(() =>
  store.getters['uploadModule/getImageProcessing']()
)

const eligibleFiles = computed(() =>
  uploadFiles.value.filter(f => isImageViewerEligible(f.name || ''))
)

const eligibleCount = computed(() => eligibleFiles.value.length)

const hasEligibleFiles = computed(() => eligibleCount.value > 0)

function toggle(key, value) {
  store.dispatch('uploadModule/setImageProcessing', { [key]: value })
}
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.image-processing-options {
  border-top: 1px solid theme.$gray_2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 16px;
  padding-top: 16px;
}

.processing-toggle {
  align-items: center;
  color: theme.$gray_6;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  font-weight: 500;
  gap: 8px;

  input[type="checkbox"] {
    accent-color: theme.$purple_2;
    cursor: pointer;
    margin: 0;
  }
}

.eligible-count {
  color: theme.$gray_4;
  font-weight: 400;
}

.sub-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 24px;
  margin-top: 4px;
}

.processing-option {
  align-items: center;
  color: theme.$gray_5;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;

  input[type="checkbox"] {
    accent-color: theme.$purple_2;
    cursor: pointer;
    margin: 0;
  }
}
</style>
