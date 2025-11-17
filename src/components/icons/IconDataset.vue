<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M12,3L2,7V17L12,21L22,17V7L12,3M12,5.3L18.4,8L12,10.7L5.6,8L12,5.3M4,10.2L11,13.5V19.8L4,16.5V10.2M13,13.5L20,10.2V16.5L13,19.8V13.5Z"/>
  </svg>
</template>

<script>
export default {
  name: "IconDataset",
  props: {
    width: {
      type: Number,
      default: 24,
    },
    height: {
      type: Number,
      default: 24,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>