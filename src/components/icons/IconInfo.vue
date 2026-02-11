<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 2 24 24"
  >
    <path pid="0" d="M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8m0-2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path pid="1" d="M12 7c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM12 18c-.6 0-1-.4-1-1v-6c0-.6.4-1 1-1s1 .4 1 1v6c0 .6-.4 1-1 1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconInfo",
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
