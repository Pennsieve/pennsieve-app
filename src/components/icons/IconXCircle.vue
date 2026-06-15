<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    role="img"
  >
    <!-- Solid circle in `color`; the X is knocked out in `xColor` (white by
         default) so it stays legible on a saturated/dark circle. -->
    <circle cx="12" cy="12" r="8" :fill="color" />
    <path
      :fill="xColor"
      d="M12 11.289l-2.139-2.14a.504.504 0 1 0-.712.712l2.139 2.14-2.139 2.139a.504.504 0 1 0 .712.712L12 12.713l2.139 2.14a.504.504 0 1 0 .712-.713L12.712 12l2.139-2.139a.504.504 0 1 0-.712-.712z"
    />
  </svg>
</template>

<script>
export default {
  name: "IconXCircle",
  props: {
    width: {
      type: Number,
      default: 16,
    },
    height: {
      type: Number,
      default: 16,
    },
    // Circle fill. Defaults to currentColor so it inherits the CSS `color`.
    color: {
      type: String,
      default: "currentColor",
    },
    // Fill of the "X". White by default for clear contrast on a colored circle.
    xColor: {
      type: String,
      default: "#ffffff",
    },
  },
};
</script>
