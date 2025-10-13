<template>
  <div class="dialog-overlay" v-if="dialogVisible" @click="closeDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>Create New Collection</h3>
        <button class="close-btn" @click="closeDialog">
          <IconXCircle :height="24" :width="24" />
        </button>
      </div>
      
      <div class="dialog-content">
        <form @submit.prevent="createCollection">
          <div class="form-group">
            <label for="collection-name">Collection Name *</label>
            <input
              id="collection-name"
              v-model="formData.name"
              type="text"
              placeholder="Enter collection name"
              class="form-input"
              :class="{ 'error': errors.name }"
              required
            />
            <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
          </div>
          
          <div class="form-group">
            <label for="collection-description">Description</label>
            <textarea
              id="collection-description"
              v-model="formData.description"
              placeholder="Enter collection description (optional)"
              class="form-textarea"
              rows="4"
            ></textarea>
          </div>
        </form>
      </div>
      
      <div class="dialog-actions">
        <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
        <bf-button
          class="primary"
          @click="createCollection"
          :disabled="saving || !formData.name.trim()"
        >
          {{ saving ? 'Creating...' : 'Create Collection' }}
        </bf-button>
      </div>
    </div>
  </div>
</template>

<script>
import IconXCircle from '../../icons/IconXCircle.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue"

export default {
  name: 'CreateCollectionDialog',

  components: {
    BfButton,
    IconXCircle
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      saving: false,
      formData: {
        name: '',
        description: ''
      },
      errors: {}
    }
  },

  watch: {
    dialogVisible(newVal) {
      if (newVal) {
        this.resetForm()
      }
    }
  },

  methods: {
    resetForm() {
      this.formData = {
        name: '',
        description: ''
      }
      this.errors = {}
    },

    validateForm() {
      this.errors = {}
      
      if (!this.formData.name.trim()) {
        this.errors.name = 'Collection name is required'
        return false
      }
      
      if (this.formData.name.trim().length < 2) {
        this.errors.name = 'Collection name must be at least 2 characters'
        return false
      }
      
      return true
    },

    async createCollection() {
      if (this.saving) return
      
      if (!this.validateForm()) {
        return
      }
      
      this.saving = true
      
      try {
        const collection = await this.$store.dispatch('collectionsModule/createCollection', {
          name: this.formData.name.trim(),
          description: this.formData.description.trim() || undefined
        })
        
        this.$emit('created', collection)
        this.closeDialog()
      } catch (error) {
        console.error('Error creating collection:', error)
        this.errors.general = 'Failed to create collection. Please try again.'
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
@import '../../../styles/_theme.scss';

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
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid $gray_2;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: $gray_6;
  }

  .close-btn {
    background: white;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: $gray_1;
    transition: color 0.2s ease;

    &:hover {
      color: $gray_2;
    }
  }
}

.dialog-content {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: $gray_6;
    margin-bottom: 6px;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid $gray_2;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s ease;
    font-family: inherit;
    box-sizing: border-box;

    &::placeholder {
      color: $gray_4;
    }

    &:focus {
      outline: none;
      border-color: $purple_2;
      box-shadow: 0 0 0 2px rgba(77, 98, 140, 0.1);
    }

    &.error {
      border-color: #dc3545;
    }
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .error-message {
    display: block;
    font-size: 12px;
    color: #dc3545;
    margin-top: 4px;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid $gray_2;
}
</style>