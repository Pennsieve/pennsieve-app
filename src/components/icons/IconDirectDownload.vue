<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M12 16a1 1 0 0 1-.707-.293l-3-3a1 1 0 0 1 1.414-1.414L12 13.586l2.293-2.293a1 1 0 0 1 1.414 1.414l-3 3A1 1 0 0 1 12 16z"/><path pid="1" d="M12 16a1 1 0 0 1-1-1V8a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z"/><circle pid="2" cx="12" cy="5" r="1"/><path pid="3" d="M20 20H4v-8a1 1 0 0 1 2 0v6h12v-6a1 1 0 0 1 2 0z"/>

  </svg>
</template>

<script>
export default {
  name: "IconDirectDownload",
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
