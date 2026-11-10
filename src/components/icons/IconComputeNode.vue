<template>
  <!-- A compute node: two server units, apart, each with a light and a slot (Storage's insets). -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M2 2v9h20V2H2zm18 7H4V4h16v5zM2 13v9h20v-9H2zm18 7H4v-5h16v5z" />
    <circle cx="7" cy="6.5" r="1" />
    <circle cx="7" cy="17.5" r="1" />
    <path d="M11 7.5h5c.6 0 1-.4 1-1s-.4-1-1-1h-5c-.6 0-1 .4-1 1s.4 1 1 1zM11 18.5h5c.6 0 1-.4 1-1s-.4-1-1-1h-5c-.6 0-1 .4-1 1s.4 1 1 1z" />
  </svg>
</template>

<script>
export default {
  name: "IconComputeNode",
  props: {
    width: { type: Number, default: 16 },
    height: { type: Number, default: 16 },
    color: { type: String, default: "currentColor" },
  },
};
</script>
