<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 10 6"
    :fill="color"
  >
    <path pid="0" d="M9 6c-.3 0-.5-.1-.7-.3L5 2.4 1.7 5.7c-.4.4-1 .4-1.4 0s-.4-1 0-1.4l4-4c.4-.4 1-.4 1.4 0l4 4c.4.4.4 1 0 1.4-.2.2-.4.3-.7.3z"/>

  </svg>
</template>

<script>
export default {
  name: "IconArrowUp",
  props: {
    width: {
      type: Number,
      default: 10,
    },
    height: {
      type: Number,
      default: 6,
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

.svg-flip {
  transform: rotate(180deg) scaleX(-1);
}

</style>


