<template>
  <div class="grid-container">
    <div v-for="(src, index) in bannerSlots" :key="index" class="grid-item">
      <img v-if="src" :src="src" class="img-content" @error="onImageError(index)" />
      <IconBrokenImage v-else class="fallback-icon" />
    </div>
  </div>
</template>

<script>
import IconBrokenImage from '../../icons/IconBrokenImage.vue'

export default {
  name: 'CollectionsBannerImage',

  components: {
    IconBrokenImage
  },

  props: {
    banners: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      bannerSlots: [],
      imageErrors: {}
    }
  },

  watch: {
    banners: {
      handler() {
        this.updateBannerSlots()
      },
      immediate: true
    }
  },

  methods: {
    updateBannerSlots() {
      if (Array.isArray(this.banners)) {
        // Extract URLs from banner objects and filter out errored images
        this.bannerSlots = this.banners
          .map(banner => banner?.uri || banner?.url || null)
          .filter(url => url && !this.imageErrors[url])
          .slice(0, 4) // Take only first 4 images
        
        // Fill remaining slots with null to always have 4 slots
        while (this.bannerSlots.length < 4) {
          this.bannerSlots.push(null)
        }
      } else {
        this.bannerSlots = [null, null, null, null]
      }
    },

    onImageError(index) {
      // Mark this image URL as errored and update slots
      const url = this.bannerSlots[index]
      if (url) {
        this.$set(this.imageErrors, url, true)
        this.updateBannerSlots()
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.grid-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 80px;
  height: 80px;
  overflow: hidden;
}

.grid-item {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.img-content {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback-icon {
  font-size: 12px;
  color: #bbb;
}
</style>