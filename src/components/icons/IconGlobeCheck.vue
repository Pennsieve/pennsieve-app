<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 9c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/><path pid="1" d="M18.1 15.2l-1.7 2.5-.6-.6c-.2-.2-.5-.2-.7 0s-.2.5 0 .7l1 1c.1.1.2.1.4.1.1 0 .3-.1.4-.2l2-3c.2-.2.1-.5-.1-.7-.3-.1-.6 0-.7.2zM8.1 8.7l-1 3c-.2.3-.1.6.1.9.2.2.5.4.8.4h1c.3 0 .5-.1.7-.3l1.7-1.7H14c.3 0 .5-.1.7-.3l2-2c.3-.3.4-.8.2-1.2l-.7-1.4.3-.3c1.2 1.1 2.1 2.6 2.4 4.2.1.5.6.9 1.2.8.5-.1.9-.6.8-1.2-.7-3.9-3.8-7-7.7-7.7-2.5-.4-5 .1-7.1 1.6-2.1 1.7-3.5 3.8-4 6.3-.4 2.5.1 5 1.6 7.1 1.4 2.1 3.6 3.5 6.1 3.9h.2c.5 0 .9-.3 1-.8.1-.5-.3-1.1-.8-1.2H10V16c0-.6-.4-1-1-1H7c-.3 0-.5.1-.7.3l-.8.7c-1.2-1.6-1.8-3.7-1.4-5.9.3-1.5.9-2.8 1.9-3.8.1.2.3.4.5.6l1.9.9.2.2-.3.3c-.1.1-.2.2-.2.4z"/>

  </svg>
</template>

<script>
export default {
  name: "IconGlobeCheck",
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
