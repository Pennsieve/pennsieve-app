<template>
  <div>
    <svg
      v-show="isVisible"
      xmlns="http://www.w3.org/2000/svg"
      :width="width"
      :height="height"
      viewBox="0 0 20 20"
      :fill="color"
    >
      <path pid="0" d="M8 10c1.5 0 2.8-.7 3.7-1.7.7 1 1.9 1.7 3.3 1.7 2.2 0 4-1.8 4-4s-1.8-4-4-4c-.9 0-1.8.3-2.5.9C11.7 1.2 10 0 8 0 5.2 0 3 2.2 3 5s2.2 5 5 5zm7-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zM8 2c1.7 0 3 1.3 3 3S9.7 8 8 8 5 6.7 5 5s1.3-3 3-3zM20 17c0-3.3-2.7-6-6-6-1.3 0-2.6.4-3.6 1.2-.1 0-.1.1-.1.1-.4-.1-.7-.2-1.1-.3-2.1-.3-4.2.2-5.9 1.5S.5 16.6.2 18.8c-.2.6.2 1.1.7 1.2H1c.5 0 .9-.4 1-.9.5-3.3 3.5-5.6 6.8-5.1 2.2.3 4.1 1.9 4.8 3.9H5c-.6 0-1 .4-1 1s.4 1 1 1h11.1l-.2-1.1c0-.3-.1-.6-.2-.9H20V17zm-5-1s-.1 0 0 0c-.7-1.1-1.6-2-2.6-2.6.5-.2 1-.4 1.6-.4 1.9 0 3.4 1.3 3.9 3H15z"/>

    </svg>
  </div>

</template>

<script>
export default {
  name: "IconTeam",
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

<style>
  .circle-icon {
    align-items: center;
    background: #F1F1F3;
    border-radius: 50%;
    box-sizing: border-box;
    color: #71747C;
    display: inline-flex;
    height: 32px;
    justify-content: center;
    overflow: hidden;
    width: 32px;
  }
</style>




