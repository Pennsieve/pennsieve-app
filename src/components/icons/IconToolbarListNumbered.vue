<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17 16h-6c-.6 0-1 .4-1 1s.4 1 1 1h6c.6 0 1-.4 1-1s-.4-1-1-1zM11 8h6c.6 0 1-.4 1-1s-.4-1-1-1h-6c-.6 0-1 .4-1 1s.4 1 1 1zM17 11h-6c-.6 0-1 .4-1 1s.4 1 1 1h6c.6 0 1-.4 1-1s-.4-1-1-1zM8.9 8.2h-.8V5.1h-.7c-.3.2-.7.3-1.1.3V6h.8v2.2h-1v.7h2.8v-.7zM7.3 10.8c.4 0 .6.2.6.6 0 .5-.7 1.2-1.8 2.1v.5H9v-.7H7.3c.7-.6 1.4-1.3 1.4-2v-.1c-.1-.7-.7-1.2-1.3-1.1-.5 0-1 .2-1.4.6l.5.5c.2-.3.5-.4.8-.4zM8.1 16.9c.5-.2.7-.5.7-.9 0-.7-.6-1-1.4-1-.5 0-.9.2-1.3.5l.5.5c.2-.2.5-.3.8-.3.3 0 .6.2.6.4 0 .3-.3.5-1 .5v.6c.9 0 1.1.2 1.1.5s-.3.5-.7.5c-.3 0-.7-.1-.9-.4l-.5.6c.4.4.9.6 1.4.6.8 0 1.5-.4 1.5-1.1 0-.5-.3-.9-.8-1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarListNumbered",
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
