<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M21 11.6c0-4.4-3.5-8-7.9-8.1-4.3 0-7.7 3.5-7.9 7.7v.1l-.4-.4c-.4-.4-1-.4-1.4 0-.4.4-.4 1 0 1.4L6.1 15 9 12.3c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0l-.4.4c.1-3.2 2.7-5.7 5.9-5.8 3.3 0 6 2.8 5.9 6.1 0 .8-.2 1.6-.5 2.3-.3.7-.7 1.3-1.2 1.9-.4.4-.4 1 0 1.4.2.2.4.3.7.3.3 0 .5-.1.7-.3.7-.7 1.2-1.6 1.6-2.5.5-1 .7-2 .7-3.1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconRotateLeft",
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
