<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <g data-name="&lt;research&gt;"><path pid="0" d="M13 2a8 8 0 0 0-5.84 13.4l-4.87 4.87a1 1 0 0 0 0 1.41A1 1 0 0 0 3 22a1 1 0 0 0 .71-.29l5-5A7.91 7.91 0 0 0 13 18a8 8 0 0 0 0-16zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z"/><path pid="1" d="M13 6a4 4 0 0 0-4 4 1 1 0 0 0 2 0 2 2 0 0 1 2-2 1 1 0 0 0 0-2z"/></g>

  </svg>
</template>

<script>
export default {
  name: "IconRotate",
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
