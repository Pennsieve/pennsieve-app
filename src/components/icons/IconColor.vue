<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    :fill="color"
  >
    <path pid="0" d="M11.9 21.9c-1.9 0-3.8-.8-5.2-2.2-1.2-1.2-1.9-2.7-2.1-4.4-.2-1.7.2-3.5 1.2-5 1.6-2.5 3.3-5.1 4.9-7.6.2-.3.4-.5.8-.7.4-.1.7-.1 1.1 0 .3.1.5.3.7.6l4.9 7.5c.8 1.2 1.2 2.7 1.2 4.1 0 3.4-2.2 6.3-5.5 7.2-.6.4-1.3.5-2 .5zM12 4.4c-1.5 2.3-3 4.7-4.5 7-.7 1.1-1 2.4-.8 3.7.1 1.2.7 2.4 1.6 3.2 1.4 1.4 3.4 1.9 5.2 1.4 2.4-.7 4-2.8 4-5.3 0-1.1-.3-2.1-.9-3l-4.6-7z"/>

  </svg>
</template>

<script>
export default {
  name: "IconColor",
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
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>




