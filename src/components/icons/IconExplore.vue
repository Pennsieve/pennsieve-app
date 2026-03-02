<template>
  <svg
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Graph/network icon representing exploration -->
    <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-6-6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
    <path d="M8.5 11.5l3-3m0 0l3 3m-3-3v12"/>
    <path d="M6.5 10.5L12 6l5.5 4.5"/>
    <path d="M6.5 13.5L12 18l5.5-4.5"/>
  </svg>
</template>

<script>
export default {
  name: 'IconExplore',
  props: {
    color: {
      type: String,
      default: 'currentColor'
    },
    width: {
      type: [String, Number],
      default: 24
    },
    height: {
      type: [String, Number],
      default: 24
    }
  }
}
</script>