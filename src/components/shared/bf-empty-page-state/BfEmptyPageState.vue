<template>
  <div class="bf-empty-page-state">
    <slot />
  </div>
</template>

<script>
  export default {
    name: 'BfEmptyPageState'
  }
</script>

<style scoped lang="scss">
  .bf-empty-page-state {
    font-size: 14px;
    line-height: 24px;
    margin: 0 auto;
    max-width: 720px;
    width: 100%;
    padding-top: 48px;
    text-align: center;
    color: #71747C;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  h2 {
    font-size: 50px;
    color: red;
  }
</style>
