<template>
  <div class="dialog-overlay" v-if="dialogVisible" @click="closeDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>Publishing Settings</h3>
        <button class="close-btn" @click="closeDialog">
          <IconXCircle :height="24" :width="24" />
        </button>
      </div>
      
      <div class="dialog-content">
        <div class="repo-info">
          <h4>{{ repo.name }}</h4>
          <p v-if="repo.description" class="repo-description">{{ repo.description }}</p>
        </div>
        
        <div class="publishing-options">
          <h5>Publishing Destinations</h5>
          <p class="options-description">
            Choose where you want to publish this repository when releases are created.
          </p>
          
          <div class="option-group">
            <label class="option-item">
              <input 
                type="checkbox" 
                v-model="localSettings.publishToDiscover"
                @change="onSettingsChange"
              />
              <div class="option-content">
                <strong>Pennsieve Discover</strong>
                <p>Publish to the Pennsieve Discover platform for scientific research datasets</p>
              </div>
            </label>
            
            <label class="option-item disabled">
              <input 
                type="checkbox" 
                v-model="localSettings.publishToAppstore"
                @change="onSettingsChange"
                disabled
              />
              <div class="option-content">
                <div class="option-header">
                  <strong>App Store</strong>
                  <span class="coming-soon-tag">Coming Soon</span>
                </div>
                <p>Publish to the Pennsieve App Store for computational tools and applications</p>
              </div>
            </label>
          </div>
          
          <div v-if="hasAnyPublishing" class="publishing-info">
            <h6>What happens when you publish?</h6>
            <ul>
              <li>A DOI (Digital Object Identifier) will be generated for each release</li>
              <li>Your repository will be archived and made citable</li>
              <li>Metadata will be extracted and indexed for discoverability</li>
              <li>A landing page will be created with publication details</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
        <bf-button
          class="primary"
          @click="saveSettings"
          :disabled="saving"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </bf-button>
      </div>
    </div>
  </div>
</template>

<script>
import IconXCircle from '../../icons/IconXCircle.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: 'PublishingDialog',

  components: {
    BfButton,
    IconXCircle
  },

  props: {
    repo: {
      type: Object,
      default: () => ({})
    },
    dialogVisible: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      saving: false,
      localSettings: {
        publishToDiscover: false,
        publishToAppstore: false
      }
    }
  },

  computed: {
    hasPublishingSettings() {
      return this.repo.hasOwnProperty('publishing_to_discover') && 
             this.repo.hasOwnProperty('publishing_to_appstore')
    },

    isPublished() {
      const { publishing_to_discover, publishing_to_appstore } = this.repo
      return publishing_to_discover || publishing_to_appstore
    },

    hasAnyPublishing() {
      return this.localSettings.publishToDiscover || this.localSettings.publishToAppstore
    }
  },

  watch: {
    dialogVisible(newVal) {
      if (newVal) {
        this.initializeSettings()
      }
    },

    repo: {
      handler() {
        this.initializeSettings()
      },
      immediate: true
    }
  },

  methods: {
    initializeSettings() {
      if (this.repo) {
        // Convert truthy/falsy values to boolean - handle strings, booleans, etc.
        this.localSettings = {
          publishToDiscover: Boolean(this.repo.publishing_to_discover),
          publishToAppstore: Boolean(this.repo.publishing_to_appstore)
        }
      }
    },

    onSettingsChange() {
      // Real-time validation could go here
    },

    async saveSettings() {
      if (this.saving) return
      
      this.saving = true
      
      try {
        await this.$store.dispatch('codeReposModule/updateRepoPublishingSettings', {
          repositoryId: this.repo.id,
          publishing_to_discover: this.localSettings.publishToDiscover,
          publishing_to_appstore: false // App Store is disabled, always save as false
        })
        
        this.$emit('save', {
          repo: this.repo,
          settings: {
            publishing_to_discover: this.localSettings.publishToDiscover,
            publishing_to_appstore: false // App Store is disabled, always save as false
          }
        })
        this.closeDialog()
      } catch (error) {
        console.error('Error saving publishing settings:', error)
        // You could add proper error handling here
      } finally {
        this.saving = false
      }
    },

    closeDialog() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';
@use '../../../styles/element/input';

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 600px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid theme.$gray_2;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: theme.$gray_6;
  }

  .close-btn {
    background: white;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: theme.$gray_1;
    transition: color 0.2s ease;

    &:hover {
      color: theme.$gray_2;
    }
  }
}

.dialog-content {
  padding: 24px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid theme.$gray_2;

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid theme.$gray_3;
    color: theme.$gray_6;

    &:hover:not(:disabled) {
      background: theme.$gray_1;
    }
  }

  .btn-primary {
    background: theme.$purple_1;
    color: white;

    &:hover:not(:disabled) {
      background: darken(theme.$purple_1, 10%);
    }
  }
}

.repo-info {
  margin-bottom: 24px;

  h4 {
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .repo-description {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.5;
  }
}

.publishing-options {
  h5 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .options-description {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }

  h6 {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 16px 0 8px 0;
  }
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 2px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;
  }

  input[type="checkbox"] {
    margin-top: 2px;
    transform: scale(1.2);
  }

  .option-content {
    flex: 1;

    .option-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    strong {
      display: block;
      font-weight: 500;
      color: theme.$gray_6;
      margin-bottom: 4px;
    }

    p {
      font-size: 13px;
      color: theme.$gray_5;
      margin: 0;
      line-height: 1.4;
    }
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;

    &:hover {
      border-color: theme.$gray_2;
      background: transparent;
    }

    input[type="checkbox"] {
      cursor: not-allowed;
    }

    .option-content {
      strong {
        color: theme.$gray_4;
      }

      p {
        color: theme.$gray_4;
      }
    }
  }
}

.publishing-info {
  margin-top: 20px;
  padding: 16px;
  background: theme.$gray_1;
  border-radius: 4px;

  ul {
    margin: 8px 0 0 16px;
    padding: 0;

    li {
      font-size: 13px;
      color: theme.$gray_5;
      margin-bottom: 4px;
      line-height: 1.4;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.coming-soon-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #fff3cd;
  color: #856404;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 12px;
  line-height: 1.2;
}
</style>