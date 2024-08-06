<template>
  <bf-stage element-loading-background="transparent">

    <bf-empty-page-state class="empty">
      <p>There are no github repositories yet</p>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue';

export default {
  name: 'GitHubRepositories',
  components: {
    BfEmptyPageState,
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
