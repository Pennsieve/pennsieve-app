<template>
  <el-select
    class="degree-select"
    :clearable="true"
    :disabled="disabled"
    :placeholder="placeholder"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @clear="$emit('update:modelValue', null)"
  >
    <el-option
      v-for="degree in degrees"
      :key="degree"
      :label="degree"
      :value="degree"
    />
  </el-select>
</template>

<script>
export default {
  name: 'DegreeSelect',

  emits: ['update:modelValue'],

  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: 'Select a degree'
    },
    modelValue: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      degrees: [
        'B.S.',
        'D.O.',
        'D.V.M.',
        'M.D.',
        'M.S.',
        'Ph.D.',
        'Pharm. D.'
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
.degree-select {
  width: 100%;
}
</style>