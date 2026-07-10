<template>
  <div class="thumbnail-viewer">
    <img
      v-if="thumbnailUrl"
      :src="thumbnailUrl"
      alt="Package thumbnail"
    >
    <p v-else class="no-thumbnail">No thumbnail available</p>
  </div>
</template>

<script>
export default {
  name: 'ThumbnailViewer',

  props: {
    asset: {
      type: Object,
      default: () => ({}),
    },
  },

  computed: {
    thumbnailUrl() {
      const url = this.asset?.asset_url
      const id = this.asset?.id
      const cf = this.asset?.cloudfront
      if (!url || !id) return ''
      if (!cf?.policy || !cf?.signature || !cf?.key_pair_id) return url

      const qs = new URLSearchParams({
        Policy: cf.policy,
        Signature: cf.signature,
        'Key-Pair-Id': cf.key_pair_id,
      })
      return `${url}thumbnail.png?${qs.toString()}`
    },
  },
}
</script>

<style lang="scss" scoped>
.thumbnail-viewer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

img {
  display: block;
  height: auto;
}

.no-thumbnail {
  color: #71747c;
  font-size: 14px;
}
</style>
