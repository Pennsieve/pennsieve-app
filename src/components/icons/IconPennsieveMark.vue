<template>
  <svg
      v-show="isVisible"
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      viewBox="0 0 100 114.286"
      fill="currentColor"
  >
    <path d="M57.134,0H0L.387.516A141.424,141.424,0,0,1,58.194,112.872L100,57.143ZM0,114.286H51.041A134.127,134.127,0,0,0,39.926,61.062Z"/>

     </svg>
</template>


<script>
export default {
  name: "PennsieveMark",
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

