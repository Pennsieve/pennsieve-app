<script setup>
import { computed } from 'vue'
import { ElButtonGroup, ElButton } from 'element-plus'

const props = defineProps({
  viewMode: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['large', 'default', 'small'].includes(value)
  },
  minimal: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:viewMode'])

// Ensure size prop matches Element Plus button size type
const buttonSize = computed(() => {
  const validSizes = ['large', 'default', 'small', '']
  return validSizes.includes(props.size) ? props.size : 'default'
})

const handleModeChange = (mode) => {
  emit('update:viewMode', mode)
}
</script>

<template>
  <div class="view-toggle-wrapper">
    <el-button-group class="view-toggle">
      <el-button 
        :size="buttonSize"
        :type="viewMode === 'ui' || viewMode === 'enhanced' || viewMode === 'edit' ? 'primary' : ''"
        @click="handleModeChange('ui')"
      >
        <span v-if="!minimal && (viewMode === 'edit' || viewMode === 'preview')">Edit</span>
        <span v-else-if="!minimal">Enhanced</span>
        <span v-else>👁</span>
      </el-button>
      <el-button 
        :size="buttonSize"
        :type="viewMode === 'json' || viewMode === 'preview' ? 'primary' : ''"
        @click="handleModeChange('json')"
      >
        <span v-if="!minimal && (viewMode === 'edit' || viewMode === 'preview')">Preview</span>
        <span v-else-if="!minimal">JSON</span>
        <span v-else>{ }</span>
      </el-button>
    </el-button-group>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/theme' as theme;
@use '../../../styles/element/button';


.view-toggle-wrapper {
  :deep(.el-button-group) {
    .el-button--primary {
      background-color: theme.$purple_3;
      border-color: theme.$purple_3;
      color: theme.$white;

      &:hover {
        background-color: theme.$purple_3;
        border-color: theme.$purple_3;
        color: theme.$white;
      }
    }

    .el-button:not(.el-button--primary) {
      background-color: theme.$white;
      border-color: theme.$gray_3;
      color: theme.$gray_6;

      &:hover {
        background-color: theme.$gray_1;
        border-color: theme.$gray_3;
        color: theme.$gray_6;
      }
    }
  }
}
</style>