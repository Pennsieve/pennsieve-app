<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M21.7 11.3l-9-9c-.2-.2-.4-.3-.7-.3H5.6c-.3 0-.5.1-.7.3L2.3 4.9c-.2.2-.3.4-.3.7V12c0 .3.1.5.3.7l9 9c.2.2.4.3.7.3.3 0 .5-.1.7-.3l9-9c.4-.4.4-1 0-1.4zM12 19.6l-8-8V6l2-2h5.6l8 8-7.6 7.6z"/>
    <circle pid="1" cx="8" cy="8" r="2"/>

  </svg>
</template>

<script>
export default {
  name: "IconTag",
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
