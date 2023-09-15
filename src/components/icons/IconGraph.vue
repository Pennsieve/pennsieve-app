<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M18 15.3c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm0-9.6c-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6 3.6-1.6 3.6-3.6S20 5.7 18 5.7zM6 23.1c-2.3 0-4.2-1.9-4.2-4.2s1.9-4.2 4.2-4.2 4.2 1.9 4.2 4.2-1.9 4.2-4.2 4.2zm0-6c-1 0-1.8.8-1.8 1.8S5 20.7 6 20.7s1.8-.8 1.8-1.8S7 17.1 6 17.1z"/><circle pid="1" cx="3" cy="3.9" r="1.8"/><path pid="2" d="M3 6.9c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm0-3.6c-.3 0-.6.3-.6.6s.3.6.6.6.6-.3.6-.6-.3-.6-.6-.6z"/><path pid="3" d="M4.8 16.5c-.6 0-1.1-.5-1.2-1.1L2.4 5.8c-.1-.6.4-1.2 1.1-1.3s1.3.4 1.3 1.1L6 15.2c.1.7-.4 1.3-1 1.3h-.2zM7.696 16.947l6.374-4.998 1.481 1.889-6.374 4.997z"/>

  </svg>
</template>

<script>
export default {
  name: "IconGraph",
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
