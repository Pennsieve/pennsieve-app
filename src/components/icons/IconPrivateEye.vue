<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M18.5 6.9l3.2-3.2c.4-.4.4-1 0-1.4s-1-.4-1.4 0L17 5.6c-1.4-1-3-1.6-4.9-1.6C5.3 4 2 12 2 12s1.2 2.8 3.5 5.1l-3.2 3.2c-.4.4-.4 1 0 1.4.2.2.4.3.7.3s.5-.1.7-.3L7 18.4c1.4 1 3 1.6 4.9 1.6 6.7 0 10-8 10-8s-1.1-2.8-3.4-5.1zM4.2 12c.9-1.8 3.6-6 7.8-6 1.3 0 2.5.4 3.5 1.1L14 8.6c-.6-.4-1.3-.6-2-.6-2.2 0-4 1.8-4 4 0 .7.2 1.4.6 2l-1.7 1.7c-1.3-1.3-2.2-2.8-2.7-3.7zm7.8 6c-1.3 0-2.5-.4-3.5-1.1l1.5-1.5c.6.4 1.3.6 2 .6 2.2 0 4-1.8 4-4 0-.7-.2-1.4-.6-2l1.7-1.7c1.3 1.3 2.2 2.8 2.7 3.7-1 1.8-3.6 6-7.8 6z"/>

  </svg>
</template>

<script>
export default {
  name: "IconPrivateEye",
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
