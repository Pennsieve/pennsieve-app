<template>
  <bf-dialog-header ref="dialog" />
</template>

<script>
import BfDialogHeader from './BfDialogHeader.vue'

export default {
  name: 'BfDialogHeaderTestComponent',
  components: {
    BfDialogHeader
  },
  methods: {
    handleClose: function(){
      return
    }
  }
}
</script>
