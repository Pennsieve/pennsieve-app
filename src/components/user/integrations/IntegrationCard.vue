<template>
  <div class="integration-card" :class="{ 'coming-soon': comingSoon }">
    <div class="integration-header">
      <div class="integration-icon" :class="iconClass">
        <img v-if="iconSrc" :src="iconSrc" :width="iconWidth || 32" :height="iconHeight || 32" :alt="title + ' Logo'" />
        <component v-else :is="iconComponent" :width="iconWidth || 32" :height="iconHeight || 32" />
      </div>
      <div class="integration-info">
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
    </div>
    
    <div class="integration-status">
      <div class="status" :class="statusClass">
<!--        <span class="status-indicator" :class="statusClass"></span>-->
        <span>{{ statusText }}</span>
        <div v-if="statusDetail" class="status-detail">{{ statusDetail }}</div>
      </div>
    </div>

    <div class="integration-actions">
      <slot name="actions">
        <router-link v-if="route && !comingSoon" :to="route" class="btn-configure">
          {{ actionText }}
        </router-link>
        <button v-else-if="comingSoon" class="btn-configure disabled" disabled>
          Coming Soon
        </button>
      </slot>
    </div>

    <div v-if="$slots.body" class="integration-body">
      <slot name="body"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import IconOrcid from '../../icons/IconOrcid.vue'
import IconGitHub from '../../icons/IconGitHub.vue'
import IconApi from '../../icons/IconApi.vue'
import IconIntegrations from '../../icons/IconIntegrations.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: false,
    default: ''
  },
  iconSrc: {
    type: String,
    required: false,
    default: ''
  },
  iconWidth: {
    type: Number,
    required: false,
    default: 32
  },
  iconHeight: {
    type: Number,
    required: false,
    default: 32
  },
  iconClass: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    required: true,
    validator: (value) => ['connected', 'disconnected', 'info', 'coming-soon'].includes(value)
  },
  statusText: {
    type: String,
    required: true
  },
  statusDetail: {
    type: String,
    default: ''
  },
  route: {
    type: Object,
    default: null
  },
  actionText: {
    type: String,
    default: 'Configure'
  },
  comingSoon: {
    type: Boolean,
    default: false
  }
})

const iconComponent = computed(() => {
  // Map icon names to component objects
  const iconMap = {
    'IconOrcid': IconOrcid,
    'IconGitHub': IconGitHub, 
    'IconApi': IconApi,
    'IconIntegrations': IconIntegrations
  }
  return iconMap[props.icon] || IconIntegrations
})

const statusClass = computed(() => {
  return props.status
})
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.integration-card {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 24px;
  background: white;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;
  }

  &.coming-soon {
    opacity: 0.7;
    background: theme.$gray_1;
  }
}

.integration-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;

  .integration-icon {
    margin-right: 16px;
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.orcid {
      background: rgba(166, 206, 57, 0.1);
      color: #a6ce39;
    }

    &.github {
      background: rgba(36, 41, 46, 0.1);
      color: #24292e;
    }

    &.api {
      background: rgba(102, 51, 153, 0.1);
      color: #663399;
    }

    &.future {
      background: rgba(158, 158, 158, 0.1);
      color: #9e9e9e;
    }
  }

  .integration-info {
    flex: 1;
    min-height: 60px;

    h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 600;
      color: theme.$gray_6;
    }

    p {
      margin: 0;
      font-size: 14px;
      color: theme.$gray_4;
      line-height: 1.4;
    }
  }
}

.integration-status {
  margin-bottom: 20px;

  .status {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;

    &.connected {
      color: #22c55e;
    }

    &.disconnected {
      color: theme.$gray_4;
    }

    &.info {
      color: #2196f3;
    }

    &.coming-soon {
      color: #9e9e9e;
    }
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 8px;

    &.connected {
      background: #22c55e;
    }

    &.disconnected {
      background: theme.$gray_3;
    }

    &.info {
      background: #2196f3;
    }

    &.coming-soon {
      background: #9e9e9e;
    }
  }

  .status-detail {
    font-size: 12px;
    color: theme.$gray_4;
    margin-left: 8px;
    font-family: monospace;
  }
}

.integration-actions {
  .btn-configure {
    display: inline-block;
    padding: 8px 16px;
    background: theme.$purple_1;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover:not(.disabled) {
      background: theme.$purple_2;
      text-decoration: none;
      color: white;
    }

    &.disabled {
      background: theme.$gray_3;
      color: theme.$gray_4;
      cursor: not-allowed;
    }
  }
}

.integration-body {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid theme.$gray_2;
}
</style>