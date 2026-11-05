<template>
  <!-- A brain, seen from above: a neutral mark for OpenNeuro, not its logo. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 5.5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8.5a3.2 3.2 0 0 0 .6 5.6A3.2 3.2 0 0 0 8 19a3 3 0 0 0 4 .8z" />
    <path d="M12 5.5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8.5a3.2 3.2 0 0 1-.6 5.6A3.2 3.2 0 0 1 16 19a3 3 0 0 1-4 .8z" />
    <path d="M12 5.5v14.3" />
    <path d="M8.5 9.5c1 .2 1.8.9 2 2M15.5 9.5c-1 .2-1.8.9-2 2M8 15c1-.6 2.2-.6 3 .2M16 15c-1-.6-2.2-.6-3 .2" />
  </svg>
</template>

<script>
export default {
  name: "IconBrain",
  props: {
    width: { type: Number, default: 16 },
    height: { type: Number, default: 16 },
    color: { type: String, default: "currentColor" },
  },
};
</script>
