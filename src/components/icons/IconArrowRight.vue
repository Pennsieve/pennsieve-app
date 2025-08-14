<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 6 10"
    :fill="color"
  >
    <path pid="0" d="M1 10c-.3 0-.5-.1-.7-.3-.4-.4-.4-1 0-1.4L3.6 5 .3 1.7C-.1 1.3-.1.7.3.3s1-.4 1.4 0l4 4c.4.4.4 1 0 1.4l-4 4c-.2.2-.4.3-.7.3z"/>

  </svg>
</template>

<script>
export default {
  name: "IconArrowRight",
  props: {
    width: {
      type: Number,
      default: 16,
    },
    height: {
      type: Number,
      default: 16,
    },
    color: {
      type: String,
      default: "currentColor",
    },
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>

<style scoped lang="scss">
  @import '../../assets/_variables.scss';

  .svg-flip {
    transform: rotate(0deg) scaleX(-1);
  }

</style>



