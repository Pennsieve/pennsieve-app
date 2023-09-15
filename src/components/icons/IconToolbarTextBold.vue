<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M7.5 6h4c2.5 0 4.4.7 4.4 3 0 1.2-.8 2.3-2.1 2.6v.1c1.7.3 2.6 1.2 2.6 2.8 0 2.4-2 3.5-4.6 3.5H7.5V6zm3.9 4.8c1.3 0 1.9-.6 1.9-1.5s-.6-1.2-1.8-1.2h-1.2v2.7h1.1zm.3 5.1c1.5 0 2.2-.5 2.2-1.6s-.7-1.5-2.2-1.5h-1.4v3.1h1.4z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarTextBold",
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
