<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M22 22.1L15.6 17H2V2h20v20.1zM4 15h12.4l3.6 2.9V4H4v11z"/>

  </svg>
</template>

<script>
export default {
  name: "IconHelpMessage",
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
      default: "#fff",
    },
  },
};
</script>
