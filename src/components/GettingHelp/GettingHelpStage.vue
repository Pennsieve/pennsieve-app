<template>
  <bf-stage
    slot="stage"
    element-loading-background="transparent"
  >

    <template #actions>
      <a href="https://docs.pennsieve.io" target="_blank" class="mr-16"><bf-button>Visit Documentation Hub</bf-button></a>
    </template>

    <readme-doc slug="getting-help">
      <template #pre>
        <div class="highlight-image">
          <img
            src="/src/assets/images/illustrations/illo-dr_azumi_1.svg"
            class="highlight"
            alt="azumi"
          />
        </div>
      </template>
    </readme-doc>


  </bf-stage>
</template>

<script>
import { mapGetters } from 'vuex'

import BfButton from '../shared/bf-button/BfButton.vue'
import PaginationPageMenu from '../shared/PaginationPageMenu/PaginationPageMenu.vue'
import ReadmeDoc from "../shared/readme-doc/ReadmeDoc.vue";

export default {
  name: 'DeveloperTools',

  components: {
    BfButton,
    PaginationPageMenu,
    ReadmeDoc
  },



  computed: {
    ...mapGetters([
      'activeOrganization'
    ]),

  },

}
</script>

<style scoped lang="scss">

h1 {
  font-size: 22px;
  margin-bottom: 8px;
}

p {
  max-width: 760px;
}

.buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  max-width: 380px;
  margin: 48px 0px;
}
.logo {
  width: 300px;
}

.content {
  margin-top: 40px
}

.data-usage {
  text-align: right;
}
.col-spacer {
  height: 17px;
}
.pagination-header {
  display: flex;
  justify-content: space-between
}

.logo-container {
  width: 500px;
}

.highlight-image {
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-bottom: 16px;
  .highlight {
    height:120px;
  }

}

</style>