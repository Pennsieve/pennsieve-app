<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
    class="svg-icon svg-fill"
  >
    <path
      pid="0"
      d="M2 2v20h11V11.4l2.3 2.3c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4L12 7.6l-4.7 4.7c-.4.4-.4 1 0 1.4s1 .4 1.4 0l2.3-2.3V20H4V4h16v16h-3c-.6 0-1 .4-1 1s.4 1 1 1h5V2H2z"
    />
  </svg>
</template>

<script>
export default {
  name: "IconUpload",
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
