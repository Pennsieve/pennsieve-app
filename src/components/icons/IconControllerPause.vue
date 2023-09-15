<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 20 12"
  >
    <path d="M2,0 C2.553,0 3,0.048 3,0.6 L3,11.4 C3,11.952 2.553,12 2,12 L1,12 C0.447,12 0,11.952 0,11.4 L0,0.6 C0,0.048 0.447,0 1,0 L2,0 Z M9,0 C9.553,0 10,0.048 10,0.6 L10,11.4 C10,11.952 9.553,12 9,12 L8,12 C7.447,12 7,11.952 7,11.4 L7,0.6 C7,0.048 7.447,0 8,0 L9,0 Z"/>


  </svg>
</template>

<script>
export default {
  name: "IconControllerPause",
  props: {
    width: {
      type: Number,
      default: 10,
    },
    height: {
      type: Number,
      default: 12,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>
