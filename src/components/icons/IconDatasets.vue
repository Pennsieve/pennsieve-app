<template>
  <svg
      v-show="isVisible"
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      viewBox="0 0 20 20"
      :fill="color"
  >
    <path d="M17,6c-0.6,0-1,0.4-1,1s0.4,1,1,1h1v10H7V8h6c0.6,0,1-0.4,1-1s-0.4-1-1-1H5v8H2V2h12v1c0,0.6,0.4,1,1,1s1-0.4,1-1V0H0v16h5
	v4h15V6H17z"/>

  </svg>
</template>

<script>
export default {
  name: "IconDatasets",
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
      default: "#fff",
    },
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>




