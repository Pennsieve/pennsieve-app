<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 12 12"
  >
    <path d="M10.959,0.571 L3.756,5.52 C3.756,5.52 3.477,5.721 3.477,6.001 C3.477,6.281 3.756,6.48 3.756,6.48 L10.959,11.431 C11.531,11.811 12,11.53 12,10.805 L12,1.196 C12,0.469 11.531,0.188 10.959,0.571 Z M2,0 L1,0 C0.447,0 0,0.048 0,0.6 L0,11.4 C0,11.952 0.447,12 1,12 L2,12 C2.553,12 3,11.952 3,11.4 L3,0.6 C3,0.048 2.553,0 2,0 Z"/>

  </svg>
</template>

<script>
export default {
  name: "IconPreviousPage",
  props: {
    width: {
      type: Number,
      default: 12,
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
