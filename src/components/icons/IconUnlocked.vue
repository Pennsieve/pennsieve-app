<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M10 10V6c0-1.1.9-2 2-2s2 .9 2 2c0 .6.4 1 1 1s1-.4 1-1c0-2.2-1.8-4-4-4S8 3.8 8 6v4H5v12h14V10h-9zm7 10H7v-8h10v8z"/>
    <path pid="1" d="M12 18c.6 0 1-.4 1-1v-2c0-.6-.4-1-1-1s-1 .4-1 1v2c0 .6.4 1 1 1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconUnlocked",
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
