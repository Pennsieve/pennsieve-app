<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M9 9h6v6H9zM7 11H5.4l.3-.3c.4-.4.4-1 0-1.4s-1-.4-1.4 0L1.6 12l2.7 2.7c.2.2.4.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4l-.3-.3H7c.6 0 1-.4 1-1s-.4-1-1-1zM13.3 18.3l-.3.3V17c0-.6-.4-1-1-1s-1 .4-1 1v1.6l-.3-.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l2.7 2.7 2.7-2.7c.4-.4.4-1 0-1.4s-1-.4-1.4 0zM19.7 9.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l.3.3H17c-.6 0-1 .4-1 1s.4 1 1 1h1.6l-.3.3c-.4.4-.4 1 0 1.4.2.2.5.3.7.3s.5-.1.7-.3l2.7-2.7-2.7-2.7zM12 1.6L9.3 4.3c-.4.4-.4 1 0 1.4s1 .4 1.4 0l.3-.3V7c0 .6.4 1 1 1s1-.4 1-1V5.4l.3.3c.2.2.4.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4L12 1.6z"/>

  </svg>
</template>

<script>
export default {
  name: "IconSizeToFit",
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
