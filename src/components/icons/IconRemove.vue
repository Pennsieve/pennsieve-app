<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path
      pid="0"
      d="M14.12 12l8.94-8.94A1.5 1.5 0 0 0 20.94.94L12 9.88 3.06.94A1.5 1.5 0 0 0 .94 3.06L9.88 12 .94 20.94a1.5 1.5 0 1 0 2.12 2.12L12 14.12l8.94 8.94a1.5 1.5 0 0 0 2.12-2.12z"
    />
  </svg>
</template>

<script>
export default {
  name: "IconRemove",
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
  },
};
</script>
