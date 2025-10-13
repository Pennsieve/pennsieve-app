<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M11,7H13A4,4 0 0,1 17,11V12H18A1,1 0 0,1 19,13V19A1,1 0 0,1 18,20H6A1,1 0 0,1 5,19V13A1,1 0 0,1 6,12H7V11A4,4 0 0,1 11,7M11,9A2,2 0 0,0 9,11V12H15V11A2,2 0 0,0 13,9H11Z"/>
  </svg>
</template>

<script>
export default {
  name: "IconPrivacy",
  props: {
    width: {
      type: Number,
      default: 24,
    },
    height: {
      type: Number,
      default: 24,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>