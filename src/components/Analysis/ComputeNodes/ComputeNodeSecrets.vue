<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

const props = defineProps({
  nodeId: {
    type: String,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  }
})

const computeResourcesStore = useComputeResourcesStore()

// State — GET returns keys only (values are never returned)
const userSecrets = computed(() => computeResourcesStore.getNodeSecrets(props.nodeId))
const sharedSecrets = computed(() => computeResourcesStore.getNodeSharedSecrets(props.nodeId))
const isLoadingUser = computed(() => computeResourcesStore.isNodeSecretsLoading(props.nodeId))
const isLoadingShared = computed(() => computeResourcesStore.isNodeSharedSecretsLoading(props.nodeId))

// Edit mode for user secrets
const isEditingUser = ref(false)
const editingUserSecrets = ref([]) // Array of { key, value }
const isSavingUser = ref(false)

// Edit mode for shared secrets
const isEditingShared = ref(false)
const editingSharedSecrets = ref([])
const isSavingShared = ref(false)

// Key validation regex
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

onMounted(async () => {
  await Promise.all([
    computeResourcesStore.fetchSecrets(props.nodeId),
    computeResourcesStore.fetchSharedSecrets(props.nodeId)
  ])
})

// Store now holds arrays of key names
const userSecretKeys = computed(() => userSecrets.value || [])
const sharedSecretKeys = computed(() => sharedSecrets.value || [])

// Validation
function validateSecrets(secrets) {
  const keys = new Set()
  for (const { key, value } of secrets) {
    if (!key && !value) continue
    if (!key) return 'Secret key cannot be empty'
    if (!KEY_PATTERN.test(key)) return `Invalid key "${key}". Keys must match [A-Za-z_][A-Za-z0-9_]*`
    if (key.length > 256) return `Key "${key}" exceeds 256 character limit`
    if (value && value.length > 10000) return `Value for "${key}" exceeds 10,000 character limit`
    if (keys.has(key)) return `Duplicate key "${key}"`
    keys.add(key)
  }
  if (keys.size > 50) return 'Maximum 50 secrets allowed'
  return null
}

// User secrets editing
function startEditingUser() {
  // Pre-populate with existing keys (values blank since we don't have them)
  editingUserSecrets.value = userSecretKeys.value.map(key => ({ key, value: '' }))
  if (editingUserSecrets.value.length === 0) {
    editingUserSecrets.value.push({ key: '', value: '' })
  }
  isEditingUser.value = true
}

function cancelEditingUser() {
  isEditingUser.value = false
  editingUserSecrets.value = []
}

function addUserSecretRow() {
  editingUserSecrets.value.push({ key: '', value: '' })
}

function removeUserSecretRow(index) {
  editingUserSecrets.value.splice(index, 1)
}

async function saveUserSecrets() {
  const filtered = editingUserSecrets.value.filter(s => s.key || s.value)

  const error = validateSecrets(filtered)
  if (error) {
    ElMessage.error(error)
    return
  }

  // Build map of secrets with new values to PATCH
  const secretsMap = {}
  const editedKeys = new Set()
  for (const { key, value } of filtered) {
    if (!key) continue
    editedKeys.add(key)
    if (!value && !userSecretKeys.value.includes(key)) {
      ElMessage.error(`Please provide a value for new secret "${key}"`)
      return
    }
    if (value) {
      secretsMap[key] = value
    }
  }

  // Detect keys that were removed (exist on server but not in edit list)
  const removedKeys = userSecretKeys.value.filter(k => !editedKeys.has(k))

  isSavingUser.value = true
  try {
    // Delete removed keys individually
    for (const key of removedKeys) {
      await computeResourcesStore.deleteSecret(props.nodeId, key)
    }
    // PATCH new/updated keys
    if (Object.keys(secretsMap).length > 0) {
      await computeResourcesStore.patchSecrets(props.nodeId, secretsMap)
    }
    await computeResourcesStore.fetchSecrets(props.nodeId, true)
    ElMessage.success('Secrets updated successfully')
    isEditingUser.value = false
    editingUserSecrets.value = []
  } catch (err) {
    ElMessage.error('Failed to update secrets')
  } finally {
    isSavingUser.value = false
  }
}

// Shared secrets editing
function startEditingShared() {
  editingSharedSecrets.value = sharedSecretKeys.value.map(key => ({ key, value: '' }))
  if (editingSharedSecrets.value.length === 0) {
    editingSharedSecrets.value.push({ key: '', value: '' })
  }
  isEditingShared.value = true
}

function cancelEditingShared() {
  isEditingShared.value = false
  editingSharedSecrets.value = []
}

function addSharedSecretRow() {
  editingSharedSecrets.value.push({ key: '', value: '' })
}

function removeSharedSecretRow(index) {
  editingSharedSecrets.value.splice(index, 1)
}

async function saveSharedSecrets() {
  const filtered = editingSharedSecrets.value.filter(s => s.key || s.value)

  const error = validateSecrets(filtered)
  if (error) {
    ElMessage.error(error)
    return
  }

  const secretsMap = {}
  const editedKeys = new Set()
  for (const { key, value } of filtered) {
    if (!key) continue
    editedKeys.add(key)
    if (!value && !sharedSecretKeys.value.includes(key)) {
      ElMessage.error(`Please provide a value for new secret "${key}"`)
      return
    }
    if (value) {
      secretsMap[key] = value
    }
  }

  // Detect keys that were removed
  const removedKeys = sharedSecretKeys.value.filter(k => !editedKeys.has(k))

  isSavingShared.value = true
  try {
    // Delete removed keys individually
    for (const key of removedKeys) {
      await computeResourcesStore.deleteSharedSecret(props.nodeId, key)
    }
    // PATCH new/updated keys
    if (Object.keys(secretsMap).length > 0) {
      await computeResourcesStore.patchSharedSecrets(props.nodeId, secretsMap)
    }
    await computeResourcesStore.fetchSharedSecrets(props.nodeId, true)
    ElMessage.success('Shared secrets updated successfully')
    isEditingShared.value = false
    editingSharedSecrets.value = []
  } catch (err) {
    ElMessage.error('Failed to update shared secrets')
  } finally {
    isSavingShared.value = false
  }
}
</script>

<template>
  <div class="secrets-container">
    <!-- My Secrets Section -->
    <div class="secrets-section">
      <div class="secrets-header">
        <div>
          <h3>My Secrets</h3>
          <p class="secrets-description">
            Your personal secrets for this compute node. These are private to you and will be injected into your workflow executions.
          </p>
        </div>
        <div class="secrets-actions" v-if="!isEditingUser">
          <button @click="startEditingUser" class="edit-button">
            {{ userSecretKeys.length > 0 ? 'Edit' : 'Add Secrets' }}
          </button>
        </div>
        <div class="secrets-actions" v-else>
          <button @click="saveUserSecrets" :disabled="isSavingUser" class="save-button">
            {{ isSavingUser ? 'Saving...' : 'Save' }}
          </button>
          <button @click="cancelEditingUser" class="cancel-button">Cancel</button>
        </div>
      </div>

      <div v-if="isLoadingUser" class="secrets-loading" v-loading="true" style="min-height: 60px;"></div>

      <!-- View mode: show keys only -->
      <div v-else-if="!isEditingUser">
        <div v-if="userSecretKeys.length > 0" class="secrets-key-list">
          <div v-for="key in userSecretKeys" :key="'user-' + key" class="secret-key-item">
            <span class="secret-key-name">{{ key }}</span>
            <span class="secret-value-placeholder">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
          </div>
        </div>
        <div v-else class="secrets-empty">No secrets configured</div>
      </div>

      <!-- Edit mode -->
      <div v-else class="secrets-edit">
        <div class="secrets-edit-header">
          <span class="col-key">Key</span>
          <span class="col-value">Value</span>
          <span class="col-action"></span>
        </div>
        <div v-for="(row, index) in editingUserSecrets" :key="'edit-user-' + index" class="secrets-edit-row">
          <input
            v-model="row.key"
            placeholder="SECRET_KEY"
            class="secret-input col-key"
            :class="{ invalid: row.key && !KEY_PATTERN.test(row.key) }"
          />
          <input
            v-model="row.value"
            :placeholder="userSecretKeys.includes(row.key) ? '(unchanged)' : 'secret value'"
            class="secret-input col-value"
            type="text"
          />
          <button @click="removeUserSecretRow(index)" class="remove-row-button col-action" title="Remove">
            &times;
          </button>
        </div>
        <button @click="addUserSecretRow" class="add-row-button">+ Add Secret</button>
      </div>
    </div>

    <!-- Shared Secrets Section -->
    <div class="secrets-section">
      <div class="secrets-header">
        <div>
          <h3>Shared Secrets</h3>
          <p class="secrets-description">
            Shared secrets are visible to all users with access to this node.
            <span v-if="!isOwner">Only the node owner can manage shared secrets.</span>
          </p>
        </div>
        <div class="secrets-actions" v-if="isOwner && !isEditingShared">
          <button @click="startEditingShared" class="edit-button">
            {{ sharedSecretKeys.length > 0 ? 'Edit' : 'Add Secrets' }}
          </button>
        </div>
        <div class="secrets-actions" v-else-if="isOwner && isEditingShared">
          <button @click="saveSharedSecrets" :disabled="isSavingShared" class="save-button">
            {{ isSavingShared ? 'Saving...' : 'Save' }}
          </button>
          <button @click="cancelEditingShared" class="cancel-button">Cancel</button>
        </div>
      </div>

      <div v-if="isLoadingShared" class="secrets-loading" v-loading="true" style="min-height: 60px;"></div>

      <!-- View mode: show keys only -->
      <div v-else-if="!isEditingShared">
        <div v-if="sharedSecretKeys.length > 0" class="secrets-key-list">
          <div v-for="key in sharedSecretKeys" :key="'shared-' + key" class="secret-key-item">
            <span class="secret-key-name">{{ key }}</span>
            <span class="secret-value-placeholder">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
          </div>
        </div>
        <div v-else class="secrets-empty">No shared secrets configured</div>
      </div>

      <!-- Edit mode -->
      <div v-else class="secrets-edit">
        <div class="secrets-edit-header">
          <span class="col-key">Key</span>
          <span class="col-value">Value</span>
          <span class="col-action"></span>
        </div>
        <div v-for="(row, index) in editingSharedSecrets" :key="'edit-shared-' + index" class="secrets-edit-row">
          <input
            v-model="row.key"
            placeholder="SECRET_KEY"
            class="secret-input col-key"
            :class="{ invalid: row.key && !KEY_PATTERN.test(row.key) }"
          />
          <input
            v-model="row.value"
            :placeholder="sharedSecretKeys.includes(row.key) ? '(unchanged)' : 'secret value'"
            class="secret-input col-value"
            type="text"
          />
          <button @click="removeSharedSecretRow(index)" class="remove-row-button col-action" title="Remove">
            &times;
          </button>
        </div>
        <button @click="addSharedSecretRow" class="add-row-button">+ Add Secret</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.secrets-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.secrets-section {
  &:not(:last-child) {
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid theme.$gray_2;
  }
}

.secrets-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 4px 0;
  }

  .secrets-description {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.4;
  }
}

.secrets-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;

  .edit-button,
  .save-button,
  .cancel-button {
    background: theme.$purple_1;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: theme.$purple_2;
    }

    &:disabled {
      background: theme.$gray_4;
      cursor: not-allowed;
    }
  }

  .cancel-button {
    background: theme.$gray_4;

    &:hover {
      background: theme.$gray_5;
    }
  }
}

// View mode: key list
.secrets-key-list {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  overflow: hidden;
}

.secret-key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid theme.$gray_1;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(theme.$gray_1, 0.5);
  }

  .secret-key-name {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
  }

  .secret-value-placeholder {
    font-size: 14px;
    color: theme.$gray_4;
    letter-spacing: 2px;
  }
}

.secrets-empty {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
  background: theme.$gray_1;
  border-radius: 6px;
}

// Edit mode
.secrets-edit {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  overflow: hidden;
}

.secrets-edit-header {
  display: flex;
  padding: 8px 12px;
  background: theme.$gray_1;
  border-bottom: 1px solid theme.$gray_2;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  gap: 8px;
}

.secrets-edit-row {
  display: flex;
  padding: 8px 12px;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid theme.$gray_1;
}

.col-key {
  flex: 0 0 220px;
}

.col-value {
  flex: 1;
}

.col-action {
  flex: 0 0 32px;
  text-align: center;
}

.secret-input {
  padding: 6px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: theme.$gray_6;
  background: white;

  &:focus {
    outline: none;
    border-color: theme.$purple_1;
    box-shadow: 0 0 0 2px rgba(theme.$purple_1, 0.2);
  }

  &.invalid {
    border-color: theme.$red_1;
  }

  &.col-key {
    flex: 0 0 220px;
  }

  &.col-value {
    flex: 1;
  }
}

.remove-row-button {
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$red_1;
  }
}

.add-row-button {
  display: block;
  width: 100%;
  padding: 10px;
  background: none;
  border: none;
  border-top: 1px solid theme.$gray_1;
  color: theme.$purple_1;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: background 0.2s ease;

  &:hover {
    background: theme.$gray_1;
  }
}
</style>
