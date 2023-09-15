<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 20 12"
  >
    <path d="M10,6.001 C10,6.3 9.695,6.515 9.695,6.515 L1.134,11.818 C0.51,12.227 0,11.924 0,11.149 L0,0.852 C0,0.075 0.51,-0.226 1.135,0.182 L9.696,5.487 C9.695,5.487 10,5.702 10,6.001 Z"/>
  </svg>
</template>

<script>
export default {
  name: "IconControllerPlay",
  props: {
    width: {
      type: Number,
      default: 10,
    },
    height: {
      type: Number,
      default: 12,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>
