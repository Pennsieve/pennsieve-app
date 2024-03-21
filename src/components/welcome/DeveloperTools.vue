<template>
  <bf-stage
    slot="stage"
    element-loading-background="transparent"
  >

    <template #actions>
      <a href="https://docs.pennsieve.io/reference" target="_blank" class="mr-16"><bf-button>Visit API Reference</bf-button></a>
    </template>

    <readme-doc slug="developer-tools">
      <template #pre>
        <div class="highlight-image">
          <img
            src="/src/assets/images/illustrations/spot-blackfynn-view-package.svg"
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
import ReadmeDocs from "../../mixins/readme-docs";
import ReadmeDoc from "../shared/readme-doc/ReadmeDoc.vue";

export default {
  name: 'DeveloperTools',

  components: {
    ReadmeDoc,
    BfButton,
    PaginationPageMenu,
  },

  // mixins: [
  //   ReadmeDocs
  // ],

  props: {
  },

  data() {
    return {
      summary: {},
    }
  },

  // mounted() {
  //
  //   this.getReadmeDocument('developer-tools')
  // },

  computed: {
    ...mapGetters([
      'activeOrganization'
    ]),
    docSummary: function() {
      if (this.summary) {
        return this.summary.body_html
      }
      return ''
    },

  },

}
</script>

<style scoped lang="scss">


.highlight-image {
  display: flex;
  flex-direction: row;
  justify-content: center;
  .highlight {
    height:80px;
  }

}

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

</style>