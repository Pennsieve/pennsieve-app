<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 12 16"
  >
    <path pid="0" d="M6 8a2 2 0 1 1 .001-4.001A2 2 0 0 1 6 8m0-8a6 6 0 0 0-6 6c0 4 5 10 6 10s6-6 6-10a6 6 0 0 0-6-6" _fill="#BDBDBD" fill-rule="evenodd"/>

  </svg>
</template>

<script>
export default {
  name: "IconLocationFilled",
  props: {
    width: {
      type: Number,
      default: 12,
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
