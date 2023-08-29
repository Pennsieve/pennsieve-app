<template>
  <svg
      v-show="isVisible"
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      viewBox="0 0 24 24"
      :fill="color"
  >
    <rect pid="0" x="4" y="6" width="2" height="12" rx="1" ry="1"/>
    <rect pid="1" x="8" y="16" width="12" height="2" rx="1" ry="1"/>
    <rect pid="2" x="8" y="6" width="4" height="2" rx="1" ry="1"/>
    <rect pid="3" x="8" y="11" width="8" height="2" rx="1" ry="1"/>

  </svg>
</template>

<script>
export default {
  name: "IconNavCollapse",
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




