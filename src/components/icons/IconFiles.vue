<template>
  <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      :fill="color"
  >
    <path
        d="M17.1 3.7c-.5-.1-1 .3-1.1.8s.3 1.1.8 1.1l1 .2L16 17.7l-9.9-1.5V16H14V0H0v16h4.1l-.3 1.8L17.7 20l2.4-15.8-3-.5zM2 2h10v12H2V2z"/><path pid="1" d="M9 7H5c-.6 0-1 .4-1 1s.4 1 1 1h4c.6 0 1-.4 1-1s-.4-1-1-1zM9 10H5c-.6 0-1 .4-1 1s.4 1 1 1h4c.6 0 1-.4 1-1s-.4-1-1-1zM5 6h3c.6 0 1-.4 1-1s-.4-1-1-1H5c-.6 0-1 .4-1 1s.4 1 1 1z"
    />
  </svg>
</template>

<script>
export default {
  name: "IconFiles",
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
