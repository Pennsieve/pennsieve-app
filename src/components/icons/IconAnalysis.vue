<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <g data-name="&lt;analysis&gt;"><path pid="0" d="M21 20H4V3a1 1 0 1 0-2 0v19h19a1 1 0 0 0 0-2z"/><circle pid="1" cx="7" cy="16.99" r="1"/><circle pid="2" cx="11" cy="16.99" r="1"/><circle pid="3" cx="11" cy="12.99" r="1"/><circle pid="4" cx="11" cy="8.99" r="1"/><circle pid="5" cx="15" cy="12.99" r="1"/><circle pid="6" cx="15" cy="8.99" r="1"/><circle pid="7" cx="15" cy="4.99" r="1"/><circle pid="8" cx="19" cy="4.99" r="1"/></g>

  </svg>
</template>

<script>
export default {
  name: "IconAnalysis",
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
