<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M13,7H18V9H13V7M13,11H18V13H13V11M13,15H18V17H13V15M7,7H11V17H7V7M3,3V21H21V3H3M19,19H5V5H19V19Z"/>
  </svg>
</template>

<script>
export default {
  name: "IconRepository",
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