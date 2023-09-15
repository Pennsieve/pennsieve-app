<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M21.98 17.58l-8-3.58 3.29 8 .9-3.73 3.81-.69zM2 14h2v2H2zM6 14h2v2H6zM10 14h2v2h-2zM2 10h2v2H2zM2 6h2v2H2zM14 10h2v2h-2zM14 6h2v2h-2zM2 2h2v2H2zM6 2h2v2H6zM10 2h2v2h-2zM14 2h2v2h-2z"/>


  </svg>
</template>

<script>
export default {
  name: "IconDashedAnnotation",
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
