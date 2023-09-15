<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M14.4 3.2L3.1 14.5l6.4 6.4L20.8 9.5l-6.4-6.3zM5.9 14.5L14.4 6 18 9.5 9.5 18l-3.6-3.5z"/><path pid="1" d="M14.018 10.573l.707-.707 1.414 1.414-.707.707zM11.967 12.735l.707-.707 1.414 1.414-.707.707zM9.846 14.826l.707-.707 1.414 1.414-.707.707z"/>

  </svg>
</template>

<script>
export default {
  name: "IconRuler",
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
