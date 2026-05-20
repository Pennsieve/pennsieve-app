<template>
  <!-- Default slot renders DashHeader (widget name "Jump to" + icon slot). -->
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="links-widget">
    <ul class="link-list">
      <li v-for="link in links" :key="link.label">
        <router-link :to="link.to">{{ link.label }} →</router-link>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  links: { type: Array, default: () => [] }, // [{ label, to: { name, params } }]
  widgetName: { type: String, default: 'Jump to' },
  widgetID: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
})
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.links-widget {
  padding: 0 16px 16px;
}

.link-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-list :deep(a) {
  display: block;
  font-size: 14px;
  color: theme.$purple_3;
  text-decoration: none;
}

.link-list :deep(a:hover) {
  text-decoration: underline;
}
</style>
