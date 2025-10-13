<template>
  <div class="model-header-container">
    <!-- Version Controls -->
    <div v-if="!hideSelector" class="top-controls">
      <div class="version-selector">
        <el-select 
          :model-value="selectedVersion"
          @update:model-value="$emit('version-change', $event)"
          placeholder="Select version"
          size="small"
          :loading="loadingVersion"
          class="version-dropdown"
        >
          <el-option
            v-for="version in availableVersions"
            :key="version.value"
            :label="version.label"
            :value="version.value"
          />
        </el-select>
      </div>
    </div>

    <!-- Model Information Header -->
    <div class="model-header">
      <span class="model-name">{{ modelData.display_name || modelData.name }}</span>
      <el-tag type="info" size="small" effect="plain">
        {{ Object.keys(modelData.latest_version.schema.properties).length }} properties
      </el-tag>
    </div>

  </div>
</template>

<script setup>
import { ElSelect, ElOption, ElTag } from 'element-plus'

defineProps({
  modelData: {
    type: Object,
    required: true
  },
  selectedVersion: {
    type: String,
    default: 'latest'
  },
  availableVersions: {
    type: Array,
    default: () => []
  },
  loadingVersion: {
    type: Boolean,
    default: false
  },
  viewMode: {
    type: String,
    default: 'ui'
  },
  minimal: {
    type: Boolean,
    default: false
  },
  hideSelector: {
    type: Boolean,
    default: false
  }
})

defineEmits(['version-change', 'view-mode-change'])
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.model-header-container {
  .top-controls {
    margin-left: 8px;
    margin-bottom: 8px;
    
    .version-selector {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      
      .version-dropdown {
        width: 160px;
        height: 40px;
        
        :deep(.el-input__wrapper) {
          height: 40px;
          border-radius: 4px;
          border: 1px solid theme.$gray_2;
          background-color: theme.$white;
        }
        
        :deep(.el-input__inner) {
          height: 40px;
          line-height: 40px;
          font-size: 14px;
          color: theme.$gray_6;
        }
      }
    }
  }

  .model-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 0;
    margin-left: 8px;

    .model-name {
      font-weight: 500;
      font-size: 16px;
      color: theme.$gray_6;
    }
  }

}
</style>