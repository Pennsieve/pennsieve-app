<script setup>
import { computed } from 'vue'
import IconInfo from '@/components/icons/IconInfo.vue'

const props = defineProps({
  repository: {
    type: Object,
    default: () => ({})
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select', 'view-info'])

const statusText = computed(() => {
  if (props.repository.isPublic) {
    return "ACCEPTING DATASETS"
  }
  return "PRIVATE"
})

const statusClass = computed(() => {
  if (props.repository.isPublic) {
    return "accepting"
  }
  return "private"
})

const logoPath = computed(() => {
  return props.repository?.logoFile || ''
})

function selectRepository(event) {
  event.stopPropagation()
  emit('select', props.repository)
}

function openInfoPanel(event) {
  event.stopPropagation()
  emit('view-info', props.repository)
}
</script>

<template>
  <div class="repository-list-item" :class="{ selected: selected }" @click="selectRepository">
    <div class="repository-content">
      <div class="repository-info">
        <div class="repository-status" :class="statusClass">
          {{ statusText }}
        </div>
        
        <div class="repository-title-wrapper">
          <h3 
            class="repository-title clickable-title"
            @click="openInfoPanel"
            title="Click to view repository information"
          >
            {{ repository.displayName }}
            <IconInfo :width="14" :height="14" class="title-info-icon" />
          </h3>
        </div>
        
        <p class="repository-description">
          {{ repository.description }}
        </p>
      </div>
      
      <div class="repository-logo" v-if="logoPath">
        <img
          :src="logoPath"
          :alt="`${repository.displayName} logo`"
          class="logo"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.repository-list-item {
  border-bottom: 1px solid theme.$gray_2;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: theme.$gray_1;
  }

  &.selected {
    background-color: lighten(theme.$purple_2, 40%);
    border-left: 4px solid theme.$purple_2;
  }

  &:first-child {
    border-top: none;
  }

  &:last-child {
    border-bottom: none;
  }
}

.repository-content {
  display: flex;
  align-items: center;
  padding: 24px;
  gap: 24px;
}


.repository-info {
  flex: 1;
}

.repository-status {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 8px;
  
  &.accepting {
    color: theme.$green_2;
  }
  
  &.private {
    color: theme.$gray_4;
  }
}

.repository-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.repository-title {
  font-size: 18px;
  font-weight: 500;
  color: theme.$purple_3;
  margin: 0;
  
  &.clickable-title {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    padding: 2px 4px;
    margin: -2px -4px;
    transition: all 0.2s ease;
    
    .title-info-icon {
      opacity: 1;
      transition: all 0.2s ease;
      color: theme.$gray_4;
    }
    
    &:hover {
      background-color: rgba(theme.$purple_2, 0.1);
      
      .title-info-icon {
        color: theme.$purple_3;
      }
    }
  }
}

.repository-description {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0 0 16px 0;
  max-width: 600px;
}


.repository-logo {
  flex-shrink: 0;
  
  .logo {
    height: 48px;
    width: auto;
    max-width: 120px;
    object-fit: contain;
  }
}

@media (max-width: 768px) {
  .repository-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .repository-description {
    max-width: none;
  }
}
</style>