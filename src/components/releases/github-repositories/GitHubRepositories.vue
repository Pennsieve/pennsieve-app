<template>
  <bf-stage element-loading-background="transparent">

    <bf-empty-page-state class="empty">
      <p>There are no github repositories yet</p>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter, onBeforeRouteEnter } from 'vue-router';
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue';

export default {
  name: 'GitHubRepositories',
  components: {
    BfEmptyPageState,
  },
  setup() {
    const store = useStore();
    const router = useRouter();

    const hasFeature = computed(() => store.getters.hasFeature);

    // Lifecycle hook equivalent for beforeRouteEnter
    onBeforeRouteEnter((to, from, next) => {
      next((vm) => {
        if (hasFeature.value('sandbox_org_feature')) {
          router.push({ name: 'create-org' });
        }
      });
    });

    return {
      hasFeature,
    };
  },
};
</script>

<style scoped lang="scss">

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>
