<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M22 11.4c-.1-2.7-1.3-5.1-3.3-6.9-.4-.4-1-.3-1.4.1-.4.4-.3 1 .1 1.4 1.6 1.4 2.5 3.4 2.7 5.5.1 2.1-.6 4.2-2 5.8s-3.4 2.5-5.5 2.7c-2.1.1-4.2-.6-5.8-2-1.6-1.4-2.5-3.4-2.7-5.5-.1-2.1.6-4.2 2-5.8 1.3-1.4 3.1-2.4 5-2.6V11c0 .6.4 1 1 1s1-.4 1-1V2h-1C9.2 2 6.4 3.2 4.5 5.3c-1.8 2-2.7 4.6-2.5 7.2.1 2.7 1.3 5.1 3.3 6.9C7.2 21.2 9.6 22 12 22c2.7 0 5.5-1.1 7.5-3.3 1.7-2 2.6-4.6 2.5-7.3z"/><circle pid="1" cx="12" cy="15.5" r="1.5"/>
  </svg>
</template>

<script>
export default {
  name: "IconWarningCircle",
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
