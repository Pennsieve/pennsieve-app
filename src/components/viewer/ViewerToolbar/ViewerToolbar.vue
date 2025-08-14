<template>
  <div class="viewer-toolbar">
    <slot />
  </div>
</template>

<script>
export default {
  name: "ViewerToolbar",
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.viewer-toolbar {
  align-items: center;
  background: #f7f7f7;
  display: flex;
  flex-direction: column;
  padding: 10px;
  width: 20px;
  &.left {
    border-right: 2px solid theme.$gray_2;
  }
  &.right {
    border-left: 2px solid theme.$gray_2;
  }
}
</style>
