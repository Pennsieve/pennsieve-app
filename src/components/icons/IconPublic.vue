<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="4 4 16 16"
  >
    <path pid="0" d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-6 8l1.9 1.5.6 1.4c.2.4.5.6.9.6h.2c.4-.1.8-.4.8-.9l.3-3.2.8-.7c.2-.2.3-.5.3-.7V8.4c0-.4-.2-.7-.5-.9-.3-.2-.7-.2-1 0-.3.2-.6.3-.9.4l-.1-.7c-.1-.2-.2-.3-.3-.4.9-.5 1.9-.8 3-.8h.5c0 .1 0 2.4 1.2 2.4.8.1 1.6.5 2.2 1 .1.1.2.2.3.4l.8 1.5c.2.4.6.6 1 .7 0 .3 0 .6-.1.9 0 0 0-.1-.1-.1l-.5-.4c-.2-.2-.5-.2-.7-.2l-2.6.3c-.2 0-.5.2-.6.3l-.8.9c-.2.3-.3.7-.2 1l1.2 2.9c-.5.3-1 .4-1.6.4-3.3 0-6-2.7-6-6z"/>

  </svg>
</template>

<script>
export default {
  name: "IconPublic",
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
