<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 256 256"
  >
    <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zM79.2 46.8c5.6 0 10.1 4.5 10.1 10.1s-4.5 10.1-10.1 10.1-10.1-4.5-10.1-10.1 4.5-10.1 10.1-10.1zM71.5 79.5h15.4v107h-15.4v-107zm37.9 0h41.6c35.3 0 58.1 24.4 58.1 53.3 0 29.3-22.8 53.7-58.3 53.7h-41.4V79.5zm15.4 13.5v79.5h25.4c27.3 0 43.5-18.4 43.5-39.9 0-20.7-16-39.6-43.3-39.6h-25.6z"/>
  </svg>
</template>

<script>
export default {
  name: "IconOrcid",
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
