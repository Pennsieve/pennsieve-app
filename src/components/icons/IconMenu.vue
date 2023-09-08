<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    :fill="color"
  >
    <circle cx="12" cy="12" r="2.5"/><circle cx="2.5" cy="12" r="2.5"/><circle cx="21.5" cy="12" r="2.5"/>

  </svg>
</template>

<script>

export default {
  name: "IconMenu",
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




