<template>
  <div class="bf-tag">
    {{ label }}
    <button
      type="button"
      @click="$emit('remove')"
    >
      <IconRemove
        :height="10"
        :width="10"
      />
    </button>
  </div>
</template>

<script>
import IconRemove from "../../icons/IconRemove.vue";
export default {
  name: 'BfTag',
  components: {IconRemove},
  props: {
    label: {
      type: String,
      default: ''
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.bf-tag {
  align-items: center;
  background: $gray_2;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  line-height: 1;
  padding: 8px;
  button {
    align-items: center;
    display: flex;
    margin-left: 8px;
  }
}
</style>
