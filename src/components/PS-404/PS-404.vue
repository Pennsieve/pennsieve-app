<template>
  <bf-stage class="bf-404">
    <img
      src="/src/assets/images/illustrations/illo-404.svg"
      alt="Illustration depicting 404 not found page"
      width="476"
      height="240"
    >
    <h2>We can't find that page.</h2>

    <a :href="takeMeHomeLink">
      <bf-button class="primary">
        Take Me Home
      </bf-button>
    </a>
  </bf-stage>
</template>

<script>
import { mapActions, mapState } from 'vuex'
import BfButton from '../shared/bf-button/BfButton.vue'

export default {
  name: 'NotFound',

  components: {
    BfButton
  },

  computed: {
    ...mapState([
      'pageNotFound',
      'config'
    ]),

    /**
     * Dynamic link to generate home page, based on environment
     * @returns {String}
     */
    takeMeHomeLink: function() {
      return this.config.environment === 'prod' ? 'https://app.pennsieve.io' : 'https://app.pennsieve.net'
    }
  },

  mounted() {
    this.updatePageNotFound(true)
  },

  methods: {
    ...mapActions([
      'updatePageNotFound'
    ])
  },

}
</script>

<style scoped lang="scss">
.bf-404 {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

h2 {
  font-size: 22px;
  line-height: 26px;
  font-weight: bold;
  margin-right: 30px;
}

.bf-button {
  margin-right: 30px;
}
</style>