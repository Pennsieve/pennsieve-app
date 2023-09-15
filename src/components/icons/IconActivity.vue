<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M15.69 8.29a1 1 0 0 0-1.41 0L11 11.59v5.31a1 1 0 0 0 1 1 1 1 0 0 0 1-1v-4.49l2.7-2.71a1 1 0 0 0-.01-1.41z"/><path pid="1" d="M12 2a10 10 0 0 0-6.49 2.4V3a1 1 0 0 0-2 0v5h5a1 1 0 0 0 0-2H6.72A8 8 0 1 1 4 12a8.49 8.49 0 0 1 0-.88A1 1 0 0 0 3.17 10a1 1 0 0 0-1.11.89A10 10 0 1 0 12 2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconActivity",
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
