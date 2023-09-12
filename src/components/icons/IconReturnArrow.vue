<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 12.3 10.7"
  >
    <path pid="0" class="st0" d="M3 6h7.3V1c0-.6.4-1 1-1s1 .4 1 1v6c0 .6-.4 1-1 1H3l.1-.1 1.2 1.2c.2.2.3.4.3.7 0 .2-.1.5-.3.6-.4.3-.9.3-1.3 0L.1 7.5C0 7.4 0 7.2 0 7.1c0-.2.1-.5.3-.7L3 3.7c.2-.2.4-.3.7-.3.2 0 .5.1.6.3.3.4.3.9 0 1.3L3.1 6.1 3 6z" id="return"/>
  </svg>
</template>

<script>
export default {
  name: "IconReturnArrow",
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
