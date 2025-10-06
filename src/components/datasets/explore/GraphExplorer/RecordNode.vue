<template>
  <div class="record-node" :class="{ expanded: data.expanded }">
    <div class="node-header">
      <div class="node-icon">
        <i class="el-icon-document"></i>
      </div>
      <div class="node-title">{{ data.label }}</div>
      <div class="node-actions">
        <el-tooltip content="Expand relationships" placement="top">
          <button
            class="action-btn"
            @click.stop="$emit('expand', data.id)"
          >
            <i :class="data.expanded ? 'el-icon-minus' : 'el-icon-plus'"></i>
          </button>
        </el-tooltip>
        <el-tooltip content="View details" placement="top">
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
    
    <div v-if="hasProperties" class="node-properties">
      <div
        v-for="(value, key) in displayProperties"
        :key="key"
        class="property"
      >
        <span class="prop-key">{{ key }}:</span>
        <span class="prop-value">{{ value }}</span>
      </div>
    </div>
    
    <div v-if="data.relationships && data.relationships.length > 0" class="node-stats">
      <span class="stat">
        <i class="el-icon-connection"></i>
        {{ data.relationships.length }} relationships
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElTooltip } from 'element-plus'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['expand', 'remove', 'view-details'])

const hasProperties = computed(() => {
  return props.data.properties && Object.keys(props.data.properties).length > 0
})

const displayProperties = computed(() => {
  if (!props.data.properties) return {}
  
  // Show only first 3 properties to keep node compact
  const entries = Object.entries(props.data.properties).slice(0, 3)
  const result = {}
  
  entries.forEach(([key, value]) => {
    // Truncate long values
    const displayValue = value && value.toString().length > 20
      ? value.toString().substring(0, 20) + '...'
      : value
    result[key] = displayValue
  })
  
  return result
})
</script>

<style lang="scss" scoped>
@use '@/styles/theme' as theme;

.record-node {
  background: theme.$white;
  border: 2px solid theme.$gray_3;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover {
    border-color: theme.$purple_2;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  &.expanded {
    border-color: theme.$purple_2;
    background: theme.$purple_tint;
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
  
  .node-properties {
    border-top: 1px solid theme.$gray_2;
    padding-top: 8px;
    margin-bottom: 8px;
    
    .property {
      display: flex;
      gap: 4px;
      font-size: 12px;
      margin-bottom: 4px;
      
      .prop-key {
        font-weight: 500;
        color: theme.$gray_5;
      }
      
      .prop-value {
        color: theme.$gray_6;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
  
  .node-stats {
    display: flex;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid theme.$gray_2;
    
    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: theme.$gray_5;
      
      i {
        font-size: 12px;
      }
    }
  }
}
</style>