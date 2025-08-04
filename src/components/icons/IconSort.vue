<template>
  <svg
    class="icon-sort"
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    :fill="color"
  >
    <g data-name="&lt;sort&gt;"><path pid="0" d="M7 5L2.29 9.24a.84.84 0 0 0 0 1.27 1.06 1.06 0 0 0 1.41 0L6 8.45v8.64A1 1 0 0 0 7 18a1 1 0 0 0 1-.9V8.45l2.29 2.06a1.05 1.05 0 0 0 .71.27 1 1 0 0 0 .7-.27.84.84 0 0 0 0-1.27zM21 16h-6a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2zM15 14h4a1 1 0 0 0 0-2h-4a1 1 0 0 0 0 2zM15 10h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2z"/></g>

  </svg>
</template>

<script>
export default {
  name: "IconSort",
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

<style scoped lang="scss">

.icon-sort {
  margin-left: 4px;
}

.svg-flip {
  transform: rotate(180deg) scaleX(-1);
}

</style>