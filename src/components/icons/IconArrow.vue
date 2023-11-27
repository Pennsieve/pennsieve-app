<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    :fill="color"
  >
    <path pid="0" d="M14.43 17.07L19 12l-4.57-5.07a.91.91 0 0 0-1.38 0 1.18 1.18 0 0 0 0 1.52l2.23 2.47H6a1.09 1.09 0 0 0 0 2.16h9.31l-2.23 2.47a1.17 1.17 0 0 0-.28.76 1.19 1.19 0 0 0 .28.76.91.91 0 0 0 1.35 0z"/>

  </svg>
</template>

<script>
export default {
  name: "IconArrow",
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




