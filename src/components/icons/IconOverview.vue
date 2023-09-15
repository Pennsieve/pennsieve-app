<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M2 11h9V2H2v9zm2-7h5v5H4V4zM13 2v9h9V2h-9zm7 7h-5V4h5v5zM13 22h9v-9h-9v9zm2-7h5v5h-5v-5zM2 22h9v-9H2v9zm2-7h5v5H4v-5z"/>

  </svg>
</template>

<script>
export default {
  name: "IconOverview",
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
