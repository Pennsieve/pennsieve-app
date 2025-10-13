<template>
  <div class="dataset-banner-image">
    <img
      v-if="bannerSrc && !imageError"
      ref="img"
      :src="bannerSrc"
      class="dataset-image"
      alt="Dataset Banner Image"
      @error="onError"
    />
    <div v-else class="default-banner">
      <IconBrokenImage :width="32" :height="32" color="#9ca3af" />
    </div>
  </div>
</template>

<script>
import IconBrokenImage from '../../icons/IconBrokenImage.vue'

export default {
  name: 'DatasetBannerImage',

  components: {
    IconBrokenImage
  },

  props: {
    src: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      bannerSrc: '',
      imageError: false
    }
  },

  watch: {
    src: {
      handler(val) {
        this.bannerSrc = val
        this.imageError = false
      },
      immediate: true
    }
  },

  methods: {
    onError() {
      this.imageError = true
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.dataset-banner-image {
  width: 86px;
  height: 86px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;

  .dataset-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .default-banner {
    width: 100%;
    height: 100%;
    background: theme.$gray_1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid theme.$gray_2;
  }
}
</style>