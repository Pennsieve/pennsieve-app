<template>
  <img
    v-if="isVisible"
    src="../../assets/images/logos/I3H_Logo_HiRes_NoBKG_White.png"
    alt="Logo for I3H"
  />
</template>

<script>
export default {
  name: "IconI3HLogo",
  props: {
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>
