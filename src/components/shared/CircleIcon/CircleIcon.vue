<template>
  <div class="circle-icon">
    <slot name="icon" />
  </div>
</template>

<script>
export default {
  name: 'CircleIcon',

  props: {
    icon: {
      type: String
    },
    height: {
      type: String,
      default: "16"
    },
    width: {
      type: String,
      default: "16"
    },
    currentColor: {
      type: String,
      default: "#71747C"
    }
  }

}
</script>


<style scoped lang="scss">
  .circle-icon {
    align-items: center;
    background: #F1F1F3;
    border-radius: 50%;
    box-sizing: border-box;
    color: #71747C;
    display: inline-flex;
    height: 32px;
    justify-content: center;
    overflow: hidden;
    width: 32px;
  }
</style>
