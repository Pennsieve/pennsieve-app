<template>
  <div 
    class="workspace-settings-card"
    :class="{ 'coming-soon': comingSoon }"
    @click="handleClick"
  >
    <div class="card-icon">
      <component :is="iconComponent" :width="48" :height="48" color="currentColor" />
    </div>
    
    <div class="card-content">
      <h3 class="card-title">{{ title }}</h3>
      <p class="card-description">{{ description }}</p>
    </div>

    <div v-if="comingSoon" class="coming-soon-badge">
      Coming Soon
    </div>

    <div class="card-arrow">
      <IconArrowRight :width="20" :height="20" color="currentColor" />
    </div>
  </div>
</template>

<script>
import IconSettings from '../icons/IconSettings.vue'
import IconDatasetSettings from '../icons/IconDatasetSettings.vue'
import IconStorage from '../icons/IconStorage.vue'
import IconLock from '../icons/IconLock.vue'
import IconGraph from '../icons/IconGraph.vue'
import IconTeam from '../icons/IconTeam.vue'
import IconArrowRight from '../icons/IconArrowRight.vue'
import IconIntegrations from '../icons/IconIntegrations.vue'
import IconAnalysis from '../icons/IconAnalysis.vue'

export default {
  name: 'WorkspaceSettingsCard',

  components: {
    IconSettings,
    IconDatasetSettings,
    IconStorage,
    IconLock,
    IconGraph,
    IconTeam,
    IconArrowRight,
    IconIntegrations,
    IconAnalysis
  },

  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    route: {
      type: Object,
      required: false
    },
    action: {
      type: Function,
      required: false
    },
    icon: {
      type: String,
      required: true
    },
    comingSoon: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    iconComponent() {
      const iconMap = {
        'settings': 'IconSettings',
        'dataset-status': 'IconDatasetSettings',
        'database': 'IconStorage',
        'security': 'IconLock',
        'analytics': 'IconGraph',
        'people': 'IconTeam',
        'integrations': 'IconIntegrations',
        'compute': 'IconAnalysis'
      }
      return iconMap[this.icon] || 'IconSettings'
    }
  },

  methods: {
    handleClick() {
      if (this.comingSoon) return
      
      if (this.route) {
        this.$router.push(this.route)
      } else if (this.action) {
        this.action()
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.workspace-settings-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  padding: 32px 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 200px;

  &:hover {
    border-color: theme.$gray_3;
    background-color: theme.$gray_1;
    .card-arrow {
      transform: translateX(4px);
    }
  }

  &.coming-soon {
    cursor: not-allowed;
    opacity: 0.6;

    &:hover {
      border-color: theme.$gray_2;
      box-shadow: none;
      transform: none;

      .card-arrow {
        transform: none;
      }
    }
  }
}

.card-icon {
  color: theme.$purple_2;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  flex: 1;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 8px 0;
}

.card-description {
  font-size: 14px;
  color: theme.$gray_4;
  line-height: 1.5;
  margin: 0;
}

.coming-soon-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: theme.$orange_1;
  color: theme.$white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.card-arrow {
  color: theme.$gray_4;
  transition: transform 0.2s ease;
  margin-top: auto;
}
</style>