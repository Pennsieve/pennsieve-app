<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Coming Soon'
  },
  description: {
    type: String,
    default: 'This feature is under development and will be available soon.'
  },
  icon: {
    type: String,
    default: '🚧'
  },
  iconComponent: {
    type: Object,
    default: null
  }
})

const pageTitle = computed(() => props.title)
const pageDescription = computed(() => props.description)
const useIconComponent = computed(() => props.iconComponent !== null)
</script>

<template>
  <div class="coming-soon-container">
    <div class="coming-soon-content">
      <div class="coming-soon-icon">
        <component 
          v-if="useIconComponent" 
          :is="iconComponent" 
          :width="64" 
          :height="64" 
          color="#999999" 
        />
        <span v-else>{{ icon }}</span>
      </div>
      <h2>{{ pageTitle }}</h2>
      <p class="description">{{ pageDescription }}</p>
      <div class="additional-info">
        <p>We're working hard to bring you this feature. Stay tuned for updates!</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.coming-soon-container {
  padding: 80px 40px;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.coming-soon-content {
  background: white;
  border-radius: 8px;
  padding: 60px 40px;
  border: 1px solid $gray_2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.coming-soon-icon {
  font-size: 64px;
  margin-bottom: 24px;
  line-height: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  
  span {
    display: block;
  }
}

h2 {
  font-weight: 300;
  font-size: 28px;
  color: $gray_6;
  margin: 0 0 16px 0;
}

.description {
  font-size: 16px;
  color: $gray_5;
  margin-bottom: 32px;
  line-height: 1.5;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.additional-info {
  padding-top: 24px;
  border-top: 1px solid $gray_2;
  
  p {
    font-size: 14px;
    color: $gray_4;
    margin: 0;
    font-style: italic;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .coming-soon-container {
    padding: 40px 20px;
  }
  
  .coming-soon-content {
    padding: 40px 24px;
  }
  
  .coming-soon-icon {
    font-size: 48px;
    
    :deep(svg) {
      width: 48px !important;
      height: 48px !important;
    }
  }
  
  h2 {
    font-size: 24px;
  }
  
  .description {
    font-size: 14px;
  }
}
</style>