<template>
  <div class="filter-input">
    <IconMagnifyingGlass
      class="mr-8"
      name="icon-magnifying-glass"
      :height="24"
      :width="24"
      />

    <input
      ref="input"
      :placeholder="placeholder"
      :value="value"
      @input="$emit('input', $event.target.value)"
    >
  </div>
</template>

<script>
import IconMagnifyingGlass from "../../icons/IconMagnifyingGlass.vue";
export default {
  name: 'FilterInput',
  components: {IconMagnifyingGlass},
  props: {
    placeholder: String,
    value: String
  },

  methods: {
    /**
     * Focus on input
     */
    focus: function() {
      this.$refs.input.focus()
    }
  }
}
</script>

<style lang="scss" scoped>
  @import '../../../assets/_variables.scss';

  .filter-input {
    align-items: center;
    border-bottom: 1px solid $gray_2;
    display: flex;
    flex-shrink: 0;
    height: 48px;
    padding: 0 16px;
    input {
      border: none;
      flex: 1;
      font-size: inherit;
      height: 100%;
      margin: 0;
      outline: none;
      padding: 0;
      &::placeholder {
        color: $gray_4
      }
    }
    .svg-icon {
      color: $gray_4;
      height: 16px;
      width: 16px;
    }
  }
</style>
