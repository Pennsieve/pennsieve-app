<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <defs/><g id="fullscreen-2" data-name="fullscreen"><path pid="0" class="cls-1" d="M18.21 4.74a.88.88 0 0 0-.64-.27.88.88 0 0 0-.65.28l-.4.4L14 7.75V6.09a.91.91 0 0 0-.89-.89.93.93 0 0 0-.64.25.89.89 0 0 0-.27.66v3.86a.88.88 0 0 0 .29.65.82.82 0 0 0 .42.22h4.06a.9.9 0 0 0 .89-.89.87.87 0 0 0-.25-.64A.93.93 0 0 0 17 9h-1.71l2.92-3a.92.92 0 0 0 0-1.26zM11.15 11.19H7.08a.9.9 0 0 0-.9.88.91.91 0 0 0 .24.64.94.94 0 0 0 .66.28h1.66l-3 3a.93.93 0 0 0 0 1.28.92.92 0 0 0 .63.28.89.89 0 0 0 .68-.27c.12-.11.24-.23.35-.35l2.6-2.66v1.66a.91.91 0 0 0 .88.9.86.86 0 0 0 .64-.24.94.94 0 0 0 .28-.66v-3.86a.91.91 0 0 0-.28-.66.92.92 0 0 0-.37-.22z"/></g>

  </svg>
</template>

<script>
export default {
  name: "IconMinimize",
  props: {
    width: {
      type: Number,
      default: 24,
    },
    height: {
      type: Number,
      default: 24,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>
