<template>
  <form id="addPermissionForm" class="add-permission-form">
    <div class="form-wrapper">
      <div class="invite-row">
        <el-select ref="selectRef" v-model="permissionForm.item" class="mr-16" clearable filterable allow-create
          value-key="id" placeholder="Find individuals, teams, or enter email address..."
          popper-class="add-permission-form-dropdown" :no-match-text="`Can't find '${searchText}'`" @clear="clearForm"
          @change="onChange" @focus="onSelectFocus" @blur="onSelectBlur">
          <template #prefix>
            <IconMagnifyingGlass class="search-icon" :height="24" :width="24" />
          </template>

          <el-option-group v-if="externalPersonOption" label="External Person">
            <el-option class="add-permission-form-option" :label="externalPersonOption.label"
              :value="externalPersonOption">
              <div class="name">
                <span v-html="highlight(searchText, externalPersonOption.label)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="Organization">
            <el-option class="add-permission-form-option" :label="`Everyone at ${organizationName}`"
              :value="organizationOption">
              <div class="name">
                <span v-html="highlight(searchText, `Everyone at ${organizationName}`)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="People">
            <el-option v-for="item in filteredUsers" :key="item.id" class="add-permission-form-option"
              :label="`${fullName(item)} ${item.email}`" :value="getUserOption(item)">
              <div class="name">
                <span v-html="highlight(searchText, fullName(item))" />
              </div>
              <div class="email">
                <span v-html="highlight(searchText, item.email)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="Teams">
            <el-option v-for="item in filteredTeams" :key="item.team.id" class="add-permission-form-option"
              :label="item.team.name" :value="getTeamOption(item)">
              <div class="name">
                <span v-html="highlight(searchText, item.team.name)" />
              </div>
            </el-option>
          </el-option-group>
        </el-select>

        <el-select ref="permissionSelectRef" v-model="permissionForm.role" class="mr-16 select-permission-input"
          placeholder="Select Permission">
          <el-option v-for="role in roles" :key="role.value" :label="role.label" :value="role.value" />
        </el-select>

        <bf-button :disabled="isFormInvalid || hasFeature('sandbox_org_feature')" :loading="processing" @click="submit"
          class="add-permission-button">
          Add
        </bf-button>

        <confirm-role-dialog :dialog-visible="confirmDialogVisible" :role="permissionForm.role" @confirm="addPermission"
          @close-dialog="onCloseConfirmRoleDialog" />
      </div>

      <div v-if="externalProvided" class="external-user-message">
        The external user will be invited to the workspace as a "Guest". This gives the user full access to this dataset
        without making the user a full member of the workspace.
        If you want to invite a user to the workspace, use the "People" tab in the workspace.

        <span class="help-link">
          (
          <a href="https://docs.pennsieve.io/docs/workspace-management" target="_blank">
            what is this?
          </a>
          )
        </span>
      </div>

      <el-input v-if="inviteeSelected" v-model="permissionForm.message" class="invite-message" :rows="4" type="textarea"
        placeholder="Enter a custom invite message..." />
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { clone, findIndex, pathEq, propOr, pathOr } from 'ramda'

import BfButton from '../../../shared/bf-button/BfButton.vue'
import ConfirmRoleDialog from '../../collaborators/ConfirmRoleDialog/ConfirmRoleDialog.vue'
import IconMagnifyingGlass from "../../../icons/IconMagnifyingGlass.vue"

// Composables
import { useHighlightText } from '../../../../composables/useHighlightText'
import { useSorter } from '../../../../composables/useSorter'

// Props
const props = defineProps({
  processing: {
    type: Boolean,
    default: false
  },
  collaborators: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['submit'])

// Store
const store = useStore()

// Composables
const { highlight } = useHighlightText()
const { returnSort } = useSorter()

// Refs
const selectRef = ref(null)
const permissionSelectRef = ref(null)

// Reactive data
const permissionForm = ref({
  item: {
    id: '',
    label: '',
    type: ''
  },
  role: '',
  message: ''
})

const searchText = ref('')
const confirmDialogVisible = ref(false)
const externalProvided = ref(false)
const externalPerson = ref({})

const roles = [
  {
    label: 'Can Manage',
    value: 'manager'
  },
  {
    label: 'Can Edit',
    value: 'editor'
  },
  {
    label: 'Can View',
    value: 'viewer'
  }
]

// Computed properties
const orgMembers = computed(() => store.state.orgMembers)
const teams = computed(() => store.state.teams)
const activeOrganization = computed(() => store.state.activeOrganization)
const hasFeature = computed(() => store.getters.hasFeature)

const isFormInvalid = computed(() => {
  const id = pathOr('', ['item', 'id'], permissionForm.value)
  const role = propOr('', 'role', permissionForm.value)
  return id === '' || role === ''
})

const inviteeSelected = computed(() => {
  const id = pathOr('', ['item', 'id'], permissionForm.value)
  return id !== ''
})

const filteredUsers = computed(() => {
  // Create a stable snapshot of collaborators to prevent reactivity issues
  const collaboratorsSnapshot = [...props.collaborators]
  return filterAndSort(['id'], orgMembers.value, 'lastName', collaboratorsSnapshot)
})

const filteredTeams = computed(() => {
  // Create a stable snapshot of collaborators to prevent reactivity issues
  const collaboratorsSnapshot = [...props.collaborators]
  return filterAndSort(['team', 'id'], teams.value, 'team.name', collaboratorsSnapshot)
    .filter(t => !t.team.systemTeamType)
})

const organizationName = computed(() => {
  return pathOr('Organization', ['organization', 'name'], activeOrganization.value)
})

const organizationId = computed(() => {
  return pathOr('', ['organization', 'id'], activeOrganization.value)
})

// Computed option objects to prevent reactivity issues
const externalPersonOption = computed(() => {
  if (!externalProvided.value || !externalPerson.value?.email) {
    return null
  }
  return {
    type: 'email',
    id: externalPerson.value.id,
    label: externalPerson.value.email
  }
})

const organizationOption = computed(() => ({
  type: 'organizations',
  id: organizationId.value,
  label: `Everyone at ${organizationName.value}`
}))

// Memoized option generators to prevent unnecessary re-renders
const getUserOption = (item) => {
  // Cache the option to prevent recreation on every render
  const cacheKey = `user_${item.id}`
  if (!getUserOption._cache) {
    getUserOption._cache = new Map()
  }

  if (!getUserOption._cache.has(cacheKey)) {
    getUserOption._cache.set(cacheKey, {
      type: 'users',
      id: item.id,
      label: fullName(item)
    })
  }

  return getUserOption._cache.get(cacheKey)
}

const getTeamOption = (item) => {
  // Cache the option to prevent recreation on every render
  const cacheKey = `team_${item.team.id}`
  if (!getTeamOption._cache) {
    getTeamOption._cache = new Map()
  }

  if (!getTeamOption._cache.has(cacheKey)) {
    getTeamOption._cache.set(cacheKey, {
      type: 'teams',
      id: item.team.id,
      label: item.team.name
    })
  }

  return getTeamOption._cache.get(cacheKey)
}

const filterAndSort = (path = [], list = [], sortBy = '', collaborators = []) => {
  let newList = clone(list)
  // Use the passed collaborators array instead of props.collaborators
  const collabsToFilter = collaborators.length > 0 ? collaborators : props.collaborators

  // Go through all collaborators and remove them from the list
  collabsToFilter.forEach(item => {
    const id = pathOr('', path, item)
    const idx = findIndex(pathEq(path, id), newList)
    if (idx >= 0) {
      newList.splice(idx, 1)
    }
  })

  // Sort filtered list
  return returnSort(sortBy, newList, 'asc')
}

const fullName = (member) => {
  const firstName = propOr('', 'firstName', member)
  const lastName = propOr('', 'lastName', member)
  return `${firstName} ${lastName}`
}

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    )
}

const checkForExternal = (input) => {
  if (validateEmail(input) !== null) {
    const newExternalPerson = {
      email: input,
      id: 'N:email:00000000-0000-0000-0000-000000000000'
    }

    // Only update if different to prevent recursive updates
    if (JSON.stringify(externalPerson.value) !== JSON.stringify(newExternalPerson)) {
      externalPerson.value = newExternalPerson
      externalProvided.value = true

      const newItem = {
        id: newExternalPerson.id,
        label: newExternalPerson.email,
        type: 'external'
      }

      // Only update form item if it's different
      if (JSON.stringify(permissionForm.value.item) !== JSON.stringify(newItem)) {
        permissionForm.value.item = newItem
      }
    }
  } else {
    if (externalProvided.value) {
      externalProvided.value = false
      externalPerson.value = {}
    }
  }
}

const onChange = (item) => {
  // Prevent recursive updates by checking if the item is already set
  if (item && typeof item === 'string') {
    // Only process if it's different from current value
    if (item !== permissionForm.value.item?.label) {
      checkForExternal(item)
    }
  } else if (item && typeof item === 'object') {
    // Handle object selection
    if (item.id !== permissionForm.value.item?.id) {
      externalProvided.value = false
      externalPerson.value = {}
    }
  } else {
    // Handle clear/null
    externalProvided.value = false
    externalPerson.value = {}
  }
}

const clearForm = () => {
  // Prevent recursive updates during form clearing
  const wasExternal = externalProvided.value

  externalProvided.value = false
  externalPerson.value = {}

  // Only update form if it's not already in default state
  const defaultState = {
    item: { id: '', label: '', type: '' },
    role: '',
    message: ''
  }

  if (JSON.stringify(permissionForm.value) !== JSON.stringify(defaultState)) {
    permissionForm.value = defaultState
  }
}

const submit = () => {
  const role = propOr('', 'role', permissionForm.value)

  if (role !== 'Viewer') {
    confirmDialogVisible.value = true
    return
  }

  addPermission()
}

const addPermission = () => {
  emit('submit', permissionForm.value)
  confirmDialogVisible.value = false
}

const onCloseConfirmRoleDialog = () => {
  confirmDialogVisible.value = false
}

// Watch for search text changes with debouncing to prevent excessive updates
const debouncedSearchText = ref('')

let searchTimeout = null
watch(
  () => selectRef.value?.query,
  (newQuery) => {
    if (newQuery !== undefined) {
      // Clear existing timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      // Debounce search text updates
      searchTimeout = setTimeout(() => {
        debouncedSearchText.value = newQuery
        searchText.value = newQuery
      }, 100)
    }
  },
  { immediate: true }
)

// Lifecycle
onUnmounted(() => {
  // Clean up timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

// Expose methods for parent component if needed
defineExpose({
  reset: clearForm
})
</script>


<style lang="scss" scoped>
@use '../../../../styles/theme';
@use '../../../../styles/element/select';

.select-permission-input {
  width: 300px;
}

.add-permission-button {
  min-width: unset;
  width: 150px;
}

.form-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;

  .invite-row {
    display: flex;
    flex: 1;
  }

  .external-user-message {
    margin: 16px 0 8px 0;
    color: theme.$purple_1;
    font-weight: 300;
  }
}

.invite-message {
  margin-top: 8px;

}

.add-permission-form {
  display: flex;
  flex-wrap: wrap;

  .el-input__prefix {
    display: flex !important;

    .svg-icon {
      align-self: center;
    }
  }
}

.add-permission-form-dropdown {
  .el-select-group__title {
    color: #000;
    font-size: 12px;
    font-weight: 700;
    line-height: inherit;
    padding: 8px 16px;
    text-transform: none;
  }

  .add-permission-form-option {
    color: #000;
    font-size: 12px;
    padding: 8px 16px;
    &.hover,
    &.selected {
      cursor: pointer;
      color: theme.$white;
      background: theme.$purple_1;

      .email {
        color: theme.$white;
      }
    }

    .email {
      color: theme.$gray_6
    }
  }
}
</style>
