<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M16 4V2H2v19c0 .6.4 1 1 1s1-.4 1-1V4h10v17c0 .6.4 1 1 1s1-.4 1-1V6h4v14h-1c-.6 0-1 .4-1 1s.4 1 1 1h3V4h-6z"/><path pid="1" d="M6 6h2v4H6zM10 6h2v4h-2zM17 8h2v2h-2zM17 12h2v2h-2zM17 16h2v2h-2zM6 12h2v4H6zM7 18h4v4H7zM10 12h2v4h-2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconOrganization",
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
