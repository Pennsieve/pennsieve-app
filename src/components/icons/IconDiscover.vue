<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 20 20"
  >
    <path pid="0" d="M19 5.6c-.2-.5-.8-.7-1.3-.5-.5.2-.7.8-.5 1.3.9 1.9 1.1 4.1.4 6.1s-2.1 3.7-4 4.6c-1.9.9-4.1 1.1-6.1.4-2-.7-3.7-2.1-4.6-4s-1.1-4.1-.4-6.1 2.1-3.7 4-4.6c2.2-1.1 4.9-1.1 7.1 0 .5.2 1.1 0 1.3-.5.2-.5 0-1.1-.5-1.3C11.6-.4 8.3-.4 5.5 1 3.1 2.2 1.3 4.2.5 6.8c-.8 2.5-.6 5.2.5 7.6 1.2 2.4 3.2 4.2 5.8 5 1.1.4 2.1.6 3.2.6 1.5 0 3-.3 4.4-1 2.4-1.2 4.2-3.2 5-5.8.9-2.5.7-5.2-.4-7.6z"/><path pid="1" d="M10 4c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/><circle pid="2" cx="10" cy="10" r="2"/>

  </svg>
</template>

<script>
export default {
  name: "IconDiscover",
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
