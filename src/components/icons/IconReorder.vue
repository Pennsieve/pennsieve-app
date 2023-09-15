<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M6.94 5.91h2v2h-2zM10.94 5.91h2v2h-2zM14.94 5.91h2v2h-2zM6.94 9.91h2v2h-2zM10.94 9.91h2v2h-2zM14.94 9.91h2v2h-2zM6.94 13.91h2v2h-2zM10.94 13.91h2v2h-2zM14.94 13.91h2v2h-2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconReorder",
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
