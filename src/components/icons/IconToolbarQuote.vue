<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17.2 7.7l.8 1.1c-1.9.6-2.8 1.3-2.8 2.2 0 .6.2.8 1 1.1.8.3 1.4 1.1 1.4 1.9 0 1.3-1.1 2.3-2.4 2.3h-.1c-1.6 0-2.8-1.4-2.8-3.3-.1-2.7 1.6-4.6 4.9-5.3zM10.9 7.7l.9 1.1c-2 .6-2.9 1.3-2.9 2.2 0 .6.3.8 1 1.1.8.3 1.4 1.1 1.4 1.9 0 1.3-1.1 2.3-2.4 2.3h-.1C7.2 16.3 6 14.9 6 13c0-2.7 1.7-4.6 4.9-5.3z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarQuote",
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
