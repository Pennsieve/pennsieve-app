<template>
  <!-- Apps: Overview's tiles, the last a plus (one to add). -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M2 11h9V2H2v9zm2-7h5v5H4V4zM13 2v9h9V2h-9zm7 7h-5V4h5v5zM2 22h9v-9H2v9zm2-7h5v5H4v-5z" />
    <path d="M17.5 13c-.6 0-1 .4-1 1v2.5H14c-.6 0-1 .4-1 1s.4 1 1 1h2.5V21c0 .6.4 1 1 1s1-.4 1-1v-2.5H21c.6 0 1-.4 1-1s-.4-1-1-1h-2.5V14c0-.6-.4-1-1-1z" />
  </svg>
</template>

<script>
export default {
  name: "IconApp",
  props: {
    width: { type: Number, default: 16 },
    height: { type: Number, default: 16 },
    color: { type: String, default: "currentColor" },
  },
};
</script>
