<template>
  <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      viewBox="0 0 24 24"
      :fill="color"
  >
    <path pid="0" d="M13 4c-3.3 0-6 2.7-6 6 0 1.3.4 2.5 1.1 3.5l-4.8 4.8c-.4.4-.4 1 0 1.4.2.2.4.3.7.3s.5-.1.7-.3l4.8-4.8c1 .7 2.2 1.1 3.5 1.1 3.3 0 6-2.7 6-6s-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
    />

  </svg>
</template>

<script>
export default {
  name: "IconMagnifyingGlass",
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
    }
  },
};
</script>
