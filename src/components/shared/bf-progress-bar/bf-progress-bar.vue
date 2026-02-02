<template>
  <div class="ps-progress-bar">
    <div
      :class="['bar', { complete: complete }]"
      :style="barStyle"
    />
  </div>
</template>

<script>
  export default {
    name: 'BfProgressBar',

    props: {
      /**
       * Amount loaded
       */
      loaded: Number,
      /**
       * Total size of item
       */
      total: Number,
      /**
       * Whether upload is complete (shows full bar)
       */
      complete: {
        type: Boolean,
        default: false
      }
    },

    computed: {
      /**
       * Compute progress
       * @returns {number}
       */
      progress: function () {
        return (this.loaded / this.total) * 100
      },

      /**
       * Compute bar style based on mode
       * @returns {Object}
       */
      barStyle: function () {
        if (this.complete) {
          return {}
        }
        return { width: Math.ceil(this.progress) + '%' }
      }
    }
  }
</script>

<style scoped lang="scss">
  @use '../../../styles/theme';

  .ps-progress-bar {
    background: theme.$gray_1;
    border-radius: 3px;
    display: inline-block;
    height: 8px;
    overflow: hidden;
    width: 100%;
    .bar {
      background: theme.$green_1;
      height: 100%;
      width: 0;

      &.complete {
        width: 100%;
      }
    }
  }
</style>
