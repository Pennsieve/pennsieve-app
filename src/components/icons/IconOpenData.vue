<template>
  <!-- Open data in the cloud: a cloud over a data store. A neutral mark for
       the Registry of Open Data on AWS, not AWS's own. -->
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
    <path d="M6.5 15.5A4.5 4.5 0 0 1 6 6.6 6 6 0 0 1 17.6 8 4 4 0 0 1 19 15.6" />
    <ellipse cx="12.5" cy="13" rx="4.5" ry="1.6" />
    <path d="M8 13v6c0 .9 2 1.6 4.5 1.6S17 19.9 17 19v-6" />
    <path d="M8 16c0 .9 2 1.6 4.5 1.6S17 16.9 17 16" />
  </svg>
</template>

<script>
export default {
  name: "IconOpenData",
  props: {
    width: { type: Number, default: 16 },
    height: { type: Number, default: 16 },
    color: { type: String, default: "currentColor" },
  },
};
</script>
