<template>
  <div class="stage-actions">
    <div class="left-actions">
      <slot name="left"/>
    </div>

    <div class="right-actions">
      <slot name="right"/>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StageActions'
}
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';

.stage-actions {
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: space-between;
}

.left-actions {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.right-actions {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
}

</style>
