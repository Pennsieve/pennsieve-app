<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M18.7 4.5l-.9-.8-6.1 9.8-3.1-2.3c-.4-.3-1.1-.2-1.4.2-.3.4-.2 1.1.2 1.4l4.9 3.7L18.2 7c1.1 1.3 1.8 3.1 1.8 5 0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8c.6 0 1-.4 1-1s-.4-1-1-1C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10c0-2.8-1.2-5.6-3.3-7.5z"/>

  </svg>
</template>

<script>
export default {
  name: "IconDoneCheckCircle",
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
