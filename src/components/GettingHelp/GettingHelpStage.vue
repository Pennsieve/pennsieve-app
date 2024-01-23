<template>
  <bf-page>

    <bf-stage
      slot="stage"
      v-loading="isLoading"
      element-loading-background="transparent"
    >

      <div>
        Office Hours:
      </div>

      <div>
        Documentation
      </div>

      <div>
        Developers
      </div>


    </bf-stage>
  </bf-page>
</template>

<script>

export default {
  name: 'GettingHelp',

  components: {

  },

  mixins: [
  ],

  props: {

  },

  data() {
    return {
      isLoading: false,
    }
  },

  mounted () {
  },

  computed: {
  },

  watch: {
  },

  methods: {


  }
}
</script>

<style scoped lang="scss">
@import '../../assets/_variables.scss';


</style>