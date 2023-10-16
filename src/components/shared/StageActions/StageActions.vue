<template>
  <div class="stage-actions">
    <div class="left-actions">
      <slot name="left"/>
    </div>

    <div class="right-actions">
      <slot name="rigth"/>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StageActions'
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.stage-actions {
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: space-between;
}

.right-actions, .left-actions {
  display: flex;
  flex-direction: row;
       }

</style>
