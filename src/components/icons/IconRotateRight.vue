<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M20.7 10.9c-.4-.4-1-.4-1.4 0l-.4.4v-.1C18.7 7 15.3 3.5 11 3.5c-4.5.1-8 3.7-8 8.1 0 1.1.2 2.1.6 3.1.4.9.9 1.8 1.6 2.5.2.2.5.3.7.3.2 0 .5-.1.7-.3.4-.4.4-1 0-1.4-.5-.5-.9-1.2-1.2-1.9-.2-.7-.4-1.5-.4-2.3 0-3.3 2.6-6 5.9-6.1 3.2 0 5.8 2.6 5.9 5.8l-.4-.4c-.4-.4-1-.4-1.4 0-.4.4-.4 1 0 1.4l2.8 2.7 2.8-2.7c.5-.4.5-1 .1-1.4z"/>

  </svg>
</template>

<script>
export default {
  name: "IconRotateRight",
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
