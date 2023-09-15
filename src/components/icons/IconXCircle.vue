<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <circle pid="0" cx="12" cy="12" r="8"/><path pid="1" d="M12 11.289l-2.139-2.14a.504.504 0 1 0-.712.712l2.139 2.14-2.139 2.139a.504.504 0 1 0 .712.712L12 12.713l2.139 2.14a.504.504 0 1 0 .712-.713L12.712 12l2.139-2.139a.504.504 0 1 0-.712-.712z" />

  </svg>
</template>

<script>
export default {
  name: "IconXCircle",
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
