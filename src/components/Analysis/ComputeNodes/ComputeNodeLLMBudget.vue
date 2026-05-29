<template>
  <div class="llm-budget-content" v-loading="isLoading">
    <p class="section-blurb">
      Caps total LLM spend across <strong>all callers</strong> on this compute
      node — chat <em>and</em> workflow applications. When the cap is reached,
      every new LLM invocation is rejected at the governor until the period
      rolls over.
      <span class="propagation-note">
        Changes take effect within ~60 seconds (governor caches the value).
      </span>
    </p>

    <!-- Read-only view -->
    <div v-if="!isEditing && config" class="budget-view">
      <div class="info-row">
        <span class="info-label">Budget cap:</span>
        <span class="info-value strong">${{ Number(config.budgetUsd).toFixed(2) }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Period:</span>
        <span class="info-value">{{ periodLabel(config.budgetPeriod) }}</span>
      </div>
      <div v-if="isOwner" class="actions-row">
        <bf-button class="small primary" @click="startEditing">Update Budget</bf-button>
      </div>
    </div>

    <div v-else-if="!isEditing && !config && !isLoading" class="budget-empty">
      No budget configured. The governor will reject all LLM calls until a cap
      is set.
      <div v-if="isOwner" class="actions-row">
        <bf-button class="small primary" @click="startEditing">Set Budget</bf-button>
      </div>
    </div>

    <!-- Edit view -->
    <div v-if="isEditing" class="budget-edit">
      <div class="info-row">
        <span class="info-label">Budget cap (USD):</span>
        <span class="info-value">
          <el-input-number
            v-model="form.budgetUsd"
            :min="0"
            :precision="2"
            :step="10"
            :controls="false"
            style="width: 200px"
          />
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Period:</span>
        <span class="info-value">
          <el-select v-model="form.budgetPeriod" size="default" style="width: 200px">
            <el-option label="Daily" value="daily" />
            <el-option label="Monthly" value="monthly" />
          </el-select>
        </span>
      </div>
      <div class="actions-row">
        <button class="processor-edit-button" :disabled="isSaving" @click="onSave">
          {{ isSaving ? 'Saving…' : 'Save' }}
        </button>
        <button class="processor-cancel-button" :disabled="isSaving" @click="cancelEditing">
          Cancel
        </button>
      </div>
    </div>

    <p v-if="loadError" class="error-line">Couldn't load budget: {{ loadError.message }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElInputNumber, ElMessage, ElOption, ElSelect } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import { useNodeLlmBudgetStore } from '@/stores/nodeLlmBudgetStore'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
})

const store = useNodeLlmBudgetStore()

const config = computed(() => store.getConfig(props.nodeId))
const isLoading = computed(() => store.isLoading(props.nodeId))
const loadError = computed(() => store.getError(props.nodeId))

const isEditing = ref(false)
const isSaving = ref(false)
const form = ref({ budgetUsd: 0, budgetPeriod: 'daily' })

function startEditing() {
  form.value = {
    budgetUsd: config.value?.budgetUsd ?? 0,
    budgetPeriod: config.value?.budgetPeriod || 'daily',
  }
  isEditing.value = true
}

function cancelEditing() {
  if (isSaving.value) return
  isEditing.value = false
}

async function onSave() {
  if (form.value.budgetUsd < 0) {
    ElMessage.error('Budget must be non-negative')
    return
  }
  isSaving.value = true
  try {
    await store.put(props.nodeId, {
      budgetUsd: Number(form.value.budgetUsd),
      budgetPeriod: form.value.budgetPeriod,
    })
    ElMessage.success('LLM budget updated')
    isEditing.value = false
  } catch (e) {
    ElMessage.error(`Failed to update budget: ${e?.message || e}`)
  } finally {
    isSaving.value = false
  }
}

function periodLabel(p) {
  if (p === 'daily') return 'Daily (resets at 00:00 UTC)'
  if (p === 'monthly') return 'Monthly (resets at the 1st of each month, UTC)'
  return p
}

onMounted(() => {
  store.fetch(props.nodeId)
})
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.llm-budget-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-blurb {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;

  strong { color: theme.$gray_6; }
  em { font-style: italic; }
}

.propagation-note {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}

.budget-view,
.budget-edit,
.budget-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.budget-empty {
  font-size: 13px;
  color: theme.$gray_5;
  padding: 12px;
  background: theme.$gray_1;
  border-radius: 6px;
  border: 1px dashed theme.$gray_2;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-label {
  min-width: 140px;
  font-size: 13px;
  color: theme.$gray_5;
}

.info-value {
  font-size: 14px;
  color: theme.$gray_6;
}

.info-value.strong {
  font-weight: 600;
  color: theme.$purple_3;
}

.actions-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.error-line {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: theme.$red_2;
}

.processor-edit-button {
  background: theme.$purple_1;
  color: theme.$white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { background: theme.$purple_2; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.processor-cancel-button {
  background: theme.$white;
  color: theme.$gray_5;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_4;
    color: theme.$gray_6;
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
