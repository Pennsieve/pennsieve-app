<template>
  <div class="general-settings-form">
    <div class="form-header">
      <h3>Workspace Configuration</h3>
      <p class="form-description">
        Configure your workspace name, appearance, and basic settings.
      </p>
    </div>

    <el-form
      ref="generalSettingsForm"
      label-position="top"
      :model="ruleForm"
      :rules="rules"
      @submit.native.prevent="updateOrg('generalSettingsForm')"
    >
      <div class="form-section">
        <h4 class="section-title">Workspace Name</h4>
        <el-form-item prop="orgName">
          <div class="form-field">
            <p class="field-description">
              The name of the workspace can be changed. This does not change the ID of the workspace.
            </p>
            <el-input
              v-model="ruleForm.orgName"
              :disabled="!hasAdminRights"
              placeholder="Enter workspace name"
              maxlength="100"
              show-word-limit
            />
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <h4 class="section-title">Workspace Colors</h4>
        <el-form-item prop="colorTheme">
        <div class="form-field">
          <p class="field-description">
            You can select two colors to create a color scheme for the workspace. These colors are used to customize the appearance of the web application.
          </p>

          <div class="color-picker-section">
            <div class="color-picker-item">
              <label class="color-label">Primary Color:</label>
              <el-color-picker 
                :disabled="!hasAdminRights" 
                v-model="ruleForm.colorTheme[1]" 
                size="large"
                show-alpha
              />
              <span class="color-preview" v-if="ruleForm.colorTheme[1]">
                {{ ruleForm.colorTheme[1] }}
              </span>
            </div>
            
            <div class="color-picker-item">
              <label class="color-label">Secondary Color:</label>
              <el-color-picker  
                :disabled="!hasAdminRights" 
                v-model="ruleForm.colorTheme[0]" 
                size="large"
                show-alpha
              />
              <span class="color-preview" v-if="ruleForm.colorTheme[0]">
                {{ ruleForm.colorTheme[0] }}
              </span>
            </div>
          </div>
          
<!--          <div class="color-preview-section" v-if="ruleForm.colorTheme[0] && ruleForm.colorTheme[1]">-->
<!--            <p class="preview-label">Preview:</p>-->
<!--            <div class="color-demo">-->
<!--              <div -->
<!--                class="demo-primary" -->
<!--                :style="{ backgroundColor: ruleForm.colorTheme[1] }"-->
<!--              >-->
<!--                Primary Color-->
<!--              </div>-->
<!--              <div -->
<!--                class="demo-secondary" -->
<!--                :style="{ backgroundColor: ruleForm.colorTheme[0] }"-->
<!--              >-->
<!--                Secondary Color-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
        </div>
        </el-form-item>
      </div>

      <div class="form-actions">
        <bf-button
          v-if="hasAdminRights"
          @click="updateOrg('generalSettingsForm')"
          :loading="isUpdating"
          class="primary"
        >
          Update Settings
        </bf-button>
        <p v-else class="no-permission-text">
          You need admin rights to modify workspace settings.
        </p>
      </div>
    </el-form>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { pathOr, propOr } from 'ramda'
import BfButton from '../../shared/bf-button/BfButton.vue'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr, useHandleXhrError } from '@/mixins/request/request_composable'
import EventBus from '@/utils/event-bus'

export default {
  name: 'GeneralSettingsForm',

  components: {
    BfButton
  },

  data() {
    return {
      isUpdating: false,
      ruleForm: {
        orgName: '',
        colorTheme: [null, null]
      },
      rules: {
        colorTheme: [
          { required: true, message: 'Please provide a color palette', trigger: 'change' }
        ],
        orgName: [
          { required: true, message: 'Please provide a workspace name', trigger: 'blur' },
          { min: 2, message: 'Workspace name must be at least 2 characters', trigger: 'blur' }
        ]
      }
    }
  },

  computed: {
    ...mapState([
      'activeOrganization',
      'config'
    ]),

    hasAdminRights() {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
        const isOwner = propOr(false, 'isOwner', this.activeOrganization)
        return isAdmin || isOwner
      }
      return false
    }
  },

  watch: {
    activeOrganization: {
      handler(activeOrg) {
        this.handleGetOrg(activeOrg)
      },
      immediate: true
    }
  },

  methods: {
    handleGetOrg(org) {
      this.ruleForm.orgName = pathOr('', ['organization', 'name'], org)

      const colorTheme = pathOr({}, ['organization', 'colorTheme'], org)
      this.ruleForm.colorTheme = [null, null]
      for (const [key, value] of Object.entries(colorTheme)) {
        this.ruleForm.colorTheme = [key, value]
      }
    },

    updateOrg(formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) {
          return
        }
        this.updateOrgRequest()
      })
    },

    async updateOrgRequest() {
      if (!this.hasAdminRights) return

      this.isUpdating = true

      try {
        const token = await useGetToken()
        const url = `${this.config.apiUrl}/organizations/${this.activeOrganization.organization.id}?api_key=${token}`
        
        let colorTheme
        if (this.ruleForm.colorTheme[0] == null || this.ruleForm.colorTheme[1] == null) {
          colorTheme = null
        } else {
          colorTheme = {}
          colorTheme[this.ruleForm.colorTheme[0]] = this.ruleForm.colorTheme[1]
        }

        await useSendXhr(url, {
          method: 'PUT',
          body: {
            name: this.ruleForm.orgName,
            colorTheme: colorTheme
          }
        })

        this.$store.dispatch('updateWorkspaceColors', {
          [this.ruleForm.colorTheme[0]]: this.ruleForm.colorTheme[1],
        })

        EventBus.$emit('toast', {
          detail: {
            type: 'MESSAGE',
            msg: `${this.ruleForm.orgName} updated successfully`
          }
        })

      } catch (error) {
        useHandleXhrError(error)
      } finally {
        this.isUpdating = false
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.general-settings-form {
  max-width: 800px;
}

.form-header {
  margin-bottom: 32px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .form-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;
  }
}

.form-section {
  margin-bottom: 32px;

  .section-title {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 16px 0;
  }
}

.form-field {
  .field-description {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 16px 0;
    line-height: 1.5;
  }
}

.color-picker-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.color-picker-item {
  display: flex;
  align-items: center;
  gap: 16px;

  .color-label {
    font-weight: 500;
    color: theme.$gray_6;
    min-width: 120px;
    font-size: 14px;
  }

  .color-preview {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    color: theme.$gray_5;
    padding: 4px 8px;
    background: theme.$gray_1;
    border-radius: 4px;
  }
}

.color-preview-section {
  margin-top: 24px;
  padding: 16px;
  background: theme.$gray_1;
  border-radius: 8px;

  .preview-label {
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
    font-size: 14px;
  }

  .color-demo {
    display: flex;
    gap: 12px;

    .demo-primary,
    .demo-secondary {
      flex: 1;
      padding: 16px;
      text-align: center;
      color: white;
      font-weight: 500;
      border-radius: 6px;
      font-size: 14px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
  }
}

.form-actions {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid theme.$gray_2;

  .no-permission-text {
    color: theme.$gray_4;
    font-style: italic;
    margin: 0;
    font-size: 14px;
  }
}

// Element UI Form Overrides
:deep(.el-form-item__label) {
  font-weight: 600;
  color: theme.$gray_6;
  margin-bottom: 8px;
  font-size: 15px;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
  border: 1px solid theme.$gray_3;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_4;
  }

  &.is-focus {
    border-color: theme.$purple_2;
    box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.1);
  }
}

:deep(.el-color-picker) {
  .el-color-picker__trigger {
    width: 48px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid theme.$gray_3;
    
    &:hover {
      border-color: theme.$gray_4;
    }
  }
}

:deep(.el-input__count) {
  font-size: 11px;
  color: theme.$gray_4;
}
</style>