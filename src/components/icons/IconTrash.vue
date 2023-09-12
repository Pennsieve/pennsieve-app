<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M21 4h-4.9a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2H3a1 1 0 0 0 0 2h1v.13l1 14L5.09 22h13.72l.13-1.85 1-14V6h1a1 1 0 0 0 0-2zm-4 16H7L6 6h12z"/><path pid="1" d="M14 18a1 1 0 0 0 1-1V9a1 1 0 0 0-2 0v8a1 1 0 0 0 1 1zM10 18a1 1 0 0 0 1-1V9a1 1 0 0 0-2 0v8a1 1 0 0 0 1 1z"/>
  </svg>
</template>

<script>
export default {
  name: "IconTrash",
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
