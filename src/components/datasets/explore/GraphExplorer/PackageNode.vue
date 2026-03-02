<template>
  <div class="package-node">
    <div class="node-header">
      <div class="node-icon">
        <i :class="getFileIcon(data.type)"></i>
      </div>
      <div class="node-title">{{ data.label }}</div>
      <div class="node-actions">
        <el-tooltip content="View file" placement="top">
          <button
            class="action-btn"
            @click.stop="$emit('view-details', data.id)"
          >
            <i class="el-icon-view"></i>
          </button>
        </el-tooltip>
        <el-tooltip content="Remove from graph" placement="top">
          <button
            class="action-btn remove"
            @click.stop="$emit('remove', data.id)"
          >
            <i class="el-icon-close"></i>
          </button>
        </el-tooltip>
      </div>
    </div>
    
    <div class="node-info">
      <div class="info-item">
        <span class="info-label">Type:</span>
        <span class="info-value">{{ data.type || 'File' }}</span>
      </div>
      <div v-if="data.size" class="info-item">
        <span class="info-label">Size:</span>
        <span class="info-value">{{ formatFileSize(data.size) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ElTooltip } from 'element-plus'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['remove', 'view-details'])

const getFileIcon = (type) => {
  const typeMap = {
    'image': 'el-icon-picture',
    'video': 'el-icon-video-camera',
    'document': 'el-icon-document',
    'spreadsheet': 'el-icon-data-board',
    'pdf': 'el-icon-document',
    'text': 'el-icon-document',
    'csv': 'el-icon-data-line',
    'json': 'el-icon-document',
    'xml': 'el-icon-document',
    'zip': 'el-icon-folder-opened',
    'folder': 'el-icon-folder'
  }
  
  return typeMap[type?.toLowerCase()] || 'el-icon-document'
}

const formatFileSize = (bytes) => {
  if (!bytes) return 'N/A'
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(2)
  
  return `${size} ${sizes[i]}`
}
</script>

<style lang="scss" scoped>
@use '@/styles/theme' as theme;

.package-node {
  background: theme.$white;
  border: 2px solid theme.$purple_1;
  border-radius: 8px;
  padding: 12px;
  min-width: 180px;
  max-width: 250px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover {
    border-color: theme.$purple_2;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    
    .node-icon {
      color: theme.$purple_2;
      font-size: 18px;
    }
    
    .node-title {
      flex: 1;
      font-weight: 600;
      font-size: 14px;
      color: theme.$gray_6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .node-actions {
      display: flex;
      gap: 4px;
      
      .action-btn {
        background: none;
        border: none;
        color: theme.$gray_5;
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        transition: all 0.2s ease;
        
        &:hover {
          background: theme.$gray_2;
          color: theme.$gray_6;
        }
        
        &.remove:hover {
          background: theme.$red_tint;
          color: theme.$red_1;
        }
        
        i {
          font-size: 14px;
        }
      }
    }
  }
  
  .node-info {
    border-top: 1px solid theme.$gray_2;
    padding-top: 8px;
    
    .info-item {
      display: flex;
      gap: 4px;
      font-size: 11px;
      margin-bottom: 4px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .info-label {
        font-weight: 500;
        color: theme.$gray_5;
      }
      
      .info-value {
        color: theme.$gray_6;
      }
    }
  }
}
</style>