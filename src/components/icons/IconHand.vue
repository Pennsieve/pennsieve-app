<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M4.08 5.33a1.25 1.25 0 0 1 1.25 1.25v4.59h.84V4.08a1.25 1.25 0 0 1 2.5 0v7.09h.83V3.25a1.25 1.25 0 0 1 2.5 0v7.92h.83V5.33a1.25 1.25 0 0 1 2.5 0v9.93l3.59-2a1.11 1.11 0 0 1 .51-.14 1 1 0 0 1 .65.25l1.09 1L14.62 21a3.32 3.32 0 0 1-2.37 1H6.17a3.34 3.34 0 0 1-3.34-3.33V6.58a1.25 1.25 0 0 1 1.25-1.25z"/>

  </svg>
</template>

<script>
export default {
  name: "IconHand",
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
