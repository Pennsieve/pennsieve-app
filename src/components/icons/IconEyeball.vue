<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M12 16a4 4 0 1 1 4-4 4.004 4.004 0 0 1-4 4zm0-6a2 2 0 1 0 2 2 2.003 2.003 0 0 0-2-2z"/><path pid="1" d="M12 20c-7.666 0-9.94-7.648-9.962-7.726L1.96 12l.078-.274C2.061 11.648 4.334 4 12 4s9.94 7.648 9.962 7.726l.078.274-.078.274C21.94 12.352 19.666 20 12 20zm-7.948-8c.436 1.229 2.481 6 7.948 6s7.513-4.772 7.948-6c-.434-1.225-2.48-6-7.948-6-5.467 0-7.512 4.771-7.948 6z"/>

  </svg>
</template>

<script>
export default {
  name: "IconEyeball",
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
