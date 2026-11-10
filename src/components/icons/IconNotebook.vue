<template>
  <!-- A notebook: Document's page with a prompt and cursor in it. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M4 2v20h16V2H4zm14 18H6V4h12v16z" />
    <path d="M8.3 8.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4L10.6 12 8.3 9.7a1 1 0 0 1 0-1.4z" />
    <path d="M14 17h1c.6 0 1-.4 1-1s-.4-1-1-1h-1c-.6 0-1 .4-1 1s.4 1 1 1z" />
  </svg>
</template>

<script>
export default {
  name: "IconNotebook",
  props: {
    width: { type: Number, default: 16 },
    height: { type: Number, default: 16 },
    color: { type: String, default: "currentColor" },
  },
};
</script>
