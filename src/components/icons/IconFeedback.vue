<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M12 2c-.4 0-.7.2-.9.5 0 .1 0 .2-.1.2v6.1c0 .6.4 1 1 1s1-.4 1-1V4.1c2.2.5 3.9 2.5 4 4.9 0 1.6-.5 2.4-1.2 3.4-.4.6-.8 1.3-1.2 2.1-.1.1-.8.5-2.6.5s-2.5-.4-2.6-.5c-.4-.9-.8-1.5-1.2-2.1C7.5 11.4 7 10.6 7 9c0-1.4.6-2.7 1.7-3.6.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4-.1C5.9 5.2 5.1 7 5 9c0 2.2.8 3.4 1.5 4.5C7.3 14.6 8 15.7 8 18c0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.3.7-3.4 1.5-4.5.7-1.1 1.5-2.3 1.5-4.5-.1-3.8-3.2-6.9-7-7zm0 18c-1.1 0-2-.9-2-2 0-.4 0-.8-.1-1.2.6.1 1.2.2 2.1.2.8 0 1.5-.1 2.1-.2 0 .4-.1.8-.1 1.2 0 1.1-.9 2-2 2z"/><circle pid="1" cx="12" cy="12" r="1"/>

  </svg>
</template>

<script>
export default {
  name: "IconFeedback",
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
