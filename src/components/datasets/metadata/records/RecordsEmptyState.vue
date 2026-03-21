<script setup>
import { useRouter } from 'vue-router'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import BfEmptyPageState from '@/components/shared/bf-empty-page-state/BfEmptyPageState.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'

const props = defineProps({
  datasetId: { type: String, default: '' }
})

const router = useRouter()

function goToModels() {
  router.push({ name: 'models-list' })
}
</script>

<template>
  <bf-stage>
    <bf-empty-page-state class="empty">
      <img
        src="../../../../assets/images/illustrations/illo-missing-models.svg"
        height="240"
        width="247"
        alt="No records illustration"
      />
      <div class="copy">
        <h2>No records yet</h2>
        <p>
          Records are instances of metadata models. To create records, you first need
          to define a model in the Models tab.
        </p>
        <bf-button @click="goToModels">
          Go to Models
        </bf-button>
      </div>
    </bf-empty-page-state>
  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../../styles/theme';

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
}

.copy {
  h2 {
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 16px 0;
  }

  p {
    color: theme.$gray_5;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 16px;
    max-width: 500px;
  }
}
</style>
