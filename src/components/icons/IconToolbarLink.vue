<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M12 14.7l-.7.7c-.7.8-2 .8-2.7 0-.8-.7-.8-2 0-2.7l.7-.7c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0l-.7.7c-1.5 1.5-1.5 4 0 5.6 1.5 1.5 4 1.5 5.6 0l.7-.7c.4-.4.4-1 0-1.4-.5-.4-1.1-.4-1.5-.1zM16.9 7.1c-1.5-1.5-4-1.5-5.6 0l-.7.7c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l.7-.7c.7-.8 2-.8 2.7 0s.8 2 0 2.7l-.7.8c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l.7-.7c1.6-1.5 1.6-4 .1-5.6z"/><path pid="1" d="M12.7 9.9l-2.8 2.8c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l2.8-2.8c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarLink",
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
