<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 20 20.2"
  >
    <path pid="0" d="M10 0L0 2.1V3c0 1 .6 9.9 3.3 12.7 1.9 1.7 4 3.1 6.2 4.3l.5.2.5-.2c2.2-1.2 4.3-2.6 6.2-4.3C19.4 12.9 20 4 20 3v-.8L10 0zm5.3 14.2c-1.6 1.4-3.4 2.7-5.3 3.7-1.9-1-3.7-2.2-5.3-3.7C3 12.5 2.3 6.7 2.1 3.7L10 2l8 1.7c-.3 3.6-1.2 9-2.7 10.5z"/><path pid="1" d="M8 6.9c0 .8.4 1.4 1.1 1.8L7 12.9h6l-2.1-4.2c.7-.3 1.1-1 1.1-1.8 0-1.1-.9-2-2-2s-2 .9-2 2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconCollaborators",
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
