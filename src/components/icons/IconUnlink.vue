<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17 7.88h-3a1 1 0 0 0 0 2h3c1.63 0 3 1 3 2.17s-1.37 2.17-3 2.17h-3a1 1 0 1 0 0 2h3c2.76 0 5-1.87 5-4.17s-2.24-4.17-5-4.17zM10 14.22H7c-1.63 0-3-1-3-2.17s1.37-2.17 3-2.17h3a1 1 0 0 0 0-2H7c-2.76 0-5 1.87-5 4.17s2.24 4.17 5 4.17h3a1 1 0 0 0 0-2zM7 18.59L5.59 20a1 1 0 0 0 0 1.41 1 1 0 0 0 .7.3 1 1 0 0 0 .71-.3L8.41 20A1 1 0 0 0 7 18.59zM17 18.59A1 1 0 0 0 15.59 20L17 21.41a1 1 0 0 0 .71.3 1 1 0 0 0 .7-.3 1 1 0 0 0 0-1.41zM12 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zM7 5.41a1 1 0 0 0 .71.3 1 1 0 0 0 .7-.3 1 1 0 0 0 0-1.41L7 2.59A1 1 0 0 0 5.59 4zM16.29 5.71a1 1 0 0 0 .71-.3L18.41 4A1 1 0 0 0 17 2.59L15.59 4a1 1 0 0 0 0 1.41 1 1 0 0 0 .7.3zM12 6a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconUnlink",
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
