<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M14 7h6a1 1 0 0 0 0-2h-6a1 1 0 0 0 0 2zM20 9h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2zM20 13h-9a1 1 0 0 0 0 2h9a1 1 0 0 0 0-2zM20 17h-9a1 1 0 0 0 0 2h9a1 1 0 0 0 0-2z"/><circle pid="1" cx="6" cy="18" r="1"/><path pid="2" d="M6.5 4.05a4.44 4.44 0 0 0-4.45 4.42 1 1 0 0 0 2 0A2.43 2.43 0 0 1 6.5 6.05 2.35 2.35 0 0 1 9 8.47C9 9.58 7.56 10.41 6.55 11S5 12 5 12.74v1.71a1 1 0 0 0 2 0v-1.36c.16-.11.39-.24.58-.36C8.84 12 11 10.72 11 8.47a4.39 4.39 0 0 0-4.5-4.42z"/>

  </svg>
</template>

<script>
export default {
  name: "IconGuide",
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
