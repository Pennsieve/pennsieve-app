<script setup>
// A compute node's allowed apps: open (any app may run) or a list of the
// apps' source repositories that may. Data targets and service steps always
// may.
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconRemove from '@/components/icons/IconRemove.vue'

const props = defineProps({
  nodeId: { type: String, required: true },
})

const store = useStore()
const computeResourcesStore = useComputeResourcesStore()

const allowedProcessors = computed(() => computeResourcesStore.getNodeAllowedProcessors(props.nodeId))
const isLoading = computed(() => computeResourcesStore.isNodeAllowedProcessorsLoading(props.nodeId))
const isEditing = ref(false)
const editingList = ref([])
const newUrl = ref('')
const isSaving = ref(false)

const isOpen = computed(() => allowedProcessors.value.length === 0)

// Known apps, one per source repository.
const availableApplications = computed(() => {
  const apps = store.state.analysisModule?.applications || []
  const seen = new Set()
  return apps.filter(app => {
    if (!app.source?.url || seen.has(app.source.url)) return false
    seen.add(app.source.url)
    return true
  })
})
const appName = (url) => availableApplications.value.find(a => a.source.url === url)?.name

function startEditing() {
  editingList.value = [...allowedProcessors.value]
  isEditing.value = true
  store.dispatch('analysisModule/fetchApplications')
}
function cancelEditing() {
  isEditing.value = false
  editingList.value = []
  newUrl.value = ''
}
function addEntry(url) {
  if (!url || editingList.value.includes(url)) return
  editingList.value.push(url)
}
function addManual() {
  const url = newUrl.value.trim()
  if (!url) return
  addEntry(url)
  newUrl.value = ''
}
async function save() {
  isSaving.value = true
  try {
    await computeResourcesStore.updateAllowedProcessors(props.nodeId, editingList.value)
    ElMessage.success('Allowed apps updated')
    isEditing.value = false
    newUrl.value = ''
  } catch (error) {
    ElMessage.error('Failed to update allowed apps')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="cn-section" v-loading="isLoading">
    <div class="cn-section-head">
      <h3 class="cn-section-title">
        Allowed apps
        <span v-if="!isEditing" class="cn-pill" :class="{ 'is-warn': !isOpen }">{{ isOpen ? 'Any app' : 'Restricted' }}</span>
      </h3>
      <bf-button v-if="!isEditing" class="small secondary" @click="startEditing">Configure</bf-button>
      <div v-else class="edit-actions">
        <bf-button class="small secondary" @click="cancelEditing">Cancel</bf-button>
        <bf-button class="small" :processing="isSaving" :disabled="isSaving" @click="save">Save</bf-button>
      </div>
    </div>

    <template v-if="!isEditing">
      <p v-if="isOpen" class="cn-blurb">Any app may run on this node.</p>
      <template v-else>
        <p class="cn-blurb">Only these apps may run on this node. Data targets and service steps always may.</p>
        <ul class="cn-list">
          <li v-for="url in allowedProcessors" :key="url">
            <span class="app-entry">
              <span v-if="appName(url)">{{ appName(url) }}</span>
              <span class="cn-mono cn-muted">{{ url }}</span>
            </span>
          </li>
        </ul>
      </template>
    </template>

    <div v-else class="edit">
      <p class="cn-blurb">
        Add the apps that may run here, by their source repository. Leave the list empty to allow any app.
        Data targets and service steps always may.
      </p>
      <div class="add-row">
        <el-select
          placeholder="Pick a known app…"
          filterable
          :model-value="''"
          class="add-select"
          @change="addEntry"
        >
          <el-option v-for="app in availableApplications" :key="app.uuid" :label="app.name" :value="app.source.url">
            <div class="app-option">
              <span>{{ app.name }}</span>
              <span class="cn-mono cn-muted">{{ app.source.url }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
      <div class="add-row">
        <el-input v-model="newUrl" placeholder="git://github.com/org/repo" @keyup.enter="addManual" />
        <bf-button class="small secondary" :disabled="!newUrl.trim()" @click="addManual">Add</bf-button>
      </div>
      <ul v-if="editingList.length" class="cn-list">
        <li v-for="(url, index) in editingList" :key="url">
          <span class="app-entry">
            <span v-if="appName(url)">{{ appName(url) }}</span>
            <span class="cn-mono cn-muted">{{ url }}</span>
          </span>
          <button type="button" class="cn-icon-button" title="Remove" @click="editingList.splice(index, 1)">
            <IconRemove :width="16" :height="16" />
          </button>
        </li>
      </ul>
      <p v-else class="cn-muted">No apps listed: any app may run.</p>
      <button v-if="editingList.length" type="button" class="cn-link-button clear" @click="editingList = []">
        Clear the list (allow any app)
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

.edit-actions {
  display: flex;
  gap: 8px;
}
.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.add-select {
  flex: 1;
}
.app-entry,
.app-option {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.4;
}
.clear {
  margin-top: 8px;
}
</style>
