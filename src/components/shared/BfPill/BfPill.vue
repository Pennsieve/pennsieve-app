<template>
  <div class="bf-pill">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'BfPill'
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.bf-pill {
  background: #f1f1f3;
  border-radius: 6px;
  color: theme.$gray_6;
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  padding: 2px 11px;
  &.green {
    background: theme.$green_1;
  }
  &.yellow {
    background: theme.$status_yellow;
  }
  &.red {
    background: theme.$red_1;
    color: #fff;
  }
  &.blue {
    background: theme.$app-primary-color;
    color: #fff;
  }
}
</style>
