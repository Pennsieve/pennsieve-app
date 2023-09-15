<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <defs/><g id="copy"><path pid="0" class="cls-1" d="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm0 10.5a2.5 2.5 0 1 1 2.5-2.5 2.5 2.5 0 0 1-2.5 2.5z"/><path pid="1" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle pid="2" cx="12" cy="12" r="2.5"/></g>

  </svg>
</template>

<script>
export default {
  name: "IconCenter",
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
