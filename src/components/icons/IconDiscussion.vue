<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M20 6v8.25h-4.778V18l-4.444-3.75H4V6h16m2-2H2v12.25h8.047l3.885 3.279 3.29 2.775V16.25H22V4z"/>

  </svg>
</template>

<script>
export default {
  name: "IconDiscussion",
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
