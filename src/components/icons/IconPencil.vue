<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M16.07 2.1L2 16v5.9h6L22 8zm3.1 5.9l-1.4 1.38-3.1-3.06 1.4-1.38zm-12 11.89h-.88v-2.18H4v-.9l9.22-9.12 3.1 3.07z"/>
  </svg>
</template>

<script>
export default {
  name: "IconPencil",
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
