<script setup>
// A compute node's Advanced tab: its deployment mode, the version of the
// node software and its update, the technical details (cloud account, node
// id, image), and destroying the node.
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'
import { deploymentMode, formatAccountId, cloudLabel } from './computeNodeHelpers'

const props = defineProps({
  node: { type: Object, required: true },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['updated'])

const route = useRoute()
const router = useRouter()
const computeResourcesStore = useComputeResourcesStore()

const mode = computed(() => deploymentMode(props.node))
const showModeDetails = ref(false)

// Node software update (always to the newest released tag, never a floating
// tag). latestVersion/updateAvailable are annotated on the GET compute-nodes
// list, so prefer the listed copy of this node over the single-node fetch.
const listedNode = computed(() => computeResourcesStore.findComputeNodeByUuid(props.node.uuid))
const latestVersion = computed(() => listedNode.value?.latestVersion || props.node.latestVersion || null)
const updateAvailable = computed(() =>
  !!latestVersion.value && (listedNode.value || props.node)?.updateAvailable === true
)
const currentVersion = computed(() => props.node.provisionerImageTag || '')
const isUpdating = ref(false)

async function updateNodeSoftware() {
  const targetTag = latestVersion.value
  if (!targetTag) return
  isUpdating.value = true
  try {
    await computeResourcesStore.updateComputeNodeDeployment(props.node.uuid, {
      provisionerImage: props.node.provisionerImage || computeResourcesStore.DEFAULT_PROVISIONER_IMAGE,
      provisionerImageTag: targetTag
    })
    emit('updated')
    ElMessage.success(`Updating the node to ${targetTag}. This typically takes 6-8 minutes.`)
  } catch (error) {
    console.error('Failed to update provisioner:', error)
    ElMessage.error('Failed to update the node')
  } finally {
    isUpdating.value = false
  }
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`${what} copied`)
  } catch {
    ElMessage.error('Failed to copy')
  }
}
const technical = computed(() => [
  { label: `${cloudLabel(props.node.account?.accountType)} account`, value: props.node.account?.accountId, shown: formatAccountId(props.node.account?.accountId) },
  { label: 'Node ID', value: props.node.uuid },
  {
    label: 'Node software image',
    value: props.node.provisionerImage ? `${props.node.provisionerImage}:${props.node.provisionerImageTag}` : '',
  },
].filter((t) => t.value))

// Destroy
const showDestroyDialog = ref(false)
const isDestroying = ref(false)
const listRoute = computed(() => route.params.orgId
  ? { name: 'compute-nodes', params: { orgId: route.params.orgId } }
  : { name: 'my-compute-nodes' })

async function confirmDestroy() {
  isDestroying.value = true
  try {
    await computeResourcesStore.deleteComputeNode(props.node.uuid)
    ElMessage.success('Compute node destroyed')
    showDestroyDialog.value = false
    router.push(listRoute.value)
  } catch (error) {
    console.error('Failed to destroy compute node:', error)
    ElMessage.error('Failed to destroy the compute node')
  } finally {
    isDestroying.value = false
  }
}
</script>

<template>
  <div class="node-advanced">
    <section class="cn-section">
      <h3 class="cn-section-title">Deployment</h3>
      <div class="cn-card">
        <dl class="cn-facts">
          <div>
            <dt>Mode</dt>
            <dd>
              <span class="cn-pill">{{ mode.label }}</span>
              <span class="cn-muted">{{ mode.summary }}</span>
              <button type="button" class="cn-link-button" @click="showModeDetails = !showModeDetails">
                {{ showModeDetails ? 'Less' : 'More' }}
              </button>
            </dd>
          </div>
          <div v-if="showModeDetails">
            <dt />
            <dd class="mode-details">{{ mode.details }}</dd>
          </div>
          <div>
            <dt>Node software</dt>
            <dd>
              <span>{{ currentVersion || 'Unknown version' }}</span>
              <span v-if="node.pendingProvisionerImageTag" class="cn-pill">Updating to {{ node.pendingProvisionerImageTag }}</span>
              <span v-else-if="updateAvailable" class="cn-pill is-warn">Update available: {{ latestVersion }}</span>
              <span v-else-if="latestVersion" class="cn-pill is-on">Up to date</span>
              <button type="button"
                v-if="canManage && updateAvailable"
                class="cn-action cn-action--primary"
                :disabled="isUpdating"
                @click="updateNodeSoftware"
              >
                Update node
              </button>
            </dd>
          </div>
          <div v-if="canManage && updateAvailable">
            <dt />
            <dd class="cn-muted">
              Updating re-provisions the node in your cloud account with the latest infrastructure changes. It typically takes 6-8 minutes.
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="cn-section">
      <h3 class="cn-section-title">Technical details</h3>
      <div class="cn-card technical">
        <dl class="cn-facts">
          <div v-for="t in technical" :key="t.label">
            <dt>{{ t.label }}</dt>
            <dd>
              <span class="cn-mono">{{ t.shown || t.value }}</span>
              <button type="button" class="cn-icon-button" :title="`Copy ${t.label}`" @click="copy(t.value, t.label)">
                <IconCopyDocument :width="14" :height="14" />
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <section v-if="canManage" class="cn-section">
      <h3 class="cn-section-title">Danger zone</h3>
      <div class="danger">
        <p>Destroy this compute node and everything it set up in your cloud account, including running tasks. This can't be undone.</p>
        <bf-button class="red" :disabled="isDestroying" @click="showDestroyDialog = true">Destroy node</bf-button>
      </div>
    </section>

    <el-dialog v-model="showDestroyDialog" title="Destroy compute node" width="480px" :close-on-click-modal="false">
      <p class="dialog-text">
        Destroying <strong>{{ node.name }}</strong> removes the node and everything it set up in your cloud account,
        including running tasks. This can't be undone.
      </p>
      <template #footer>
        <div class="dialog-footer">
          <bf-button class="secondary" @click="showDestroyDialog = false">Cancel</bf-button>
          <bf-button class="red" :processing="isDestroying" :disabled="isDestroying" @click="confirmDestroy">Destroy node</bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

.mode-details {
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
}
.danger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 20px;
  border: 1px solid theme.$red_1;
  border-radius: 6px;
  background: theme.$red_tint;

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
  }
}
.dialog-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_6;
}
</style>
