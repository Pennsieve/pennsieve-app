<template>
  <svg
      v-show="isVisible"
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      :fill="color"
  >
    <path
        d="M8 10c2.8 0 5-2.2 5-5s-2.2-5-5-5-5 2.2-5 5 2.2 5 5 5zm0-8c1.7 0 3 1.3 3 3S9.7 8 8 8 5 6.7 5 5s1.3-3 3-3zM15.9 18.9c-.5-3.5-3.3-6.3-6.8-6.8-2.1-.3-4.2.2-5.9 1.5S.4 16.7.1 18.9c-.1.5.3 1 .8 1.1H1c.5 0 .9-.4 1-.9.5-3.3 3.5-5.5 6.8-5.1 2.2.3 4.1 1.9 4.8 3.9H5c-.6 0-1 .4-1 1s.4 1 1 1h11.1l-.2-1z"
    />
  </svg>
</template>

<script>
export default {
  name: "IconPerson",
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
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>
