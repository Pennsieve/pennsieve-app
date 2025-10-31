<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M20,8H4V6C4,4.89 4.89,4 6,4H18A2,2 0 0,1 20,6V8M20,18A2,2 0 0,1 18,20H6C4.89,20 4,19.1 4,18V10H20V18M16,15A3,3 0 0,1 13,18A3,3 0 0,1 10,15A3,3 0 0,1 13,12A3,3 0 0,1 16,15M13.85,16.15L12.85,15.85L12.85,14.5H13.85V15.45L14.4,15.6L14.2,16.1L13.85,16.15Z"/>
  </svg>
</template>

<script>
export default {
  name: "IconBilling",
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