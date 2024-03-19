<template>
  <bf-stage
    slot="stage"
    element-loading-background="transparent"
  >

    <template #actions>
      <a href="https://docs.pennsieve.io/reference" target="_blank" class="mr-16"><bf-button>Visit API Reference</bf-button></a>
    </template>

    <div class="highlight-image">
      <img
        src="/src/assets/images/illustrations/spot-blackfynn-view-package.svg"
        class="highlight"
        alt="azumi"
      />
    </div>
    <div
    class='developer-docs'
    v-html="docSummary"
    />

  </bf-stage>
</template>

<script>
import { mapGetters } from 'vuex'

import BfButton from '../shared/bf-button/BfButton.vue'
import PaginationPageMenu from '../shared/PaginationPageMenu/PaginationPageMenu.vue'
import ReadmeDocs from "../../mixins/readme-docs";

export default {
  name: 'DeveloperTools',

  components: {
    BfButton,
    PaginationPageMenu,
  },

  mixins: [
    ReadmeDocs
  ],

  props: {
  },

  data() {
    return {
      summary: {},
    }
  },

  mounted() {
    this.getReadmeDocument('developer-tools')
  },

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

.developer-docs {
  //border: 1px solid $purple_tint;
  padding: 8px;
  border-radius: 4px;

  :deep(.header-scroll) {
    color: $purple_2;
    font-weight: 500;
  ;
  }
  :deep(.magic-block-textarea) {
    h1 {
      margin-bottom: 16px;
    }
    h2 {
      margin-top: 24px;
      margin-bottom: 8px;
    }
    h3 {
      font-weight: 300;
      margin-left: 16px;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    p {
      margin-left: 16px;
      &:last-child {
        margin-bottom: 0;
      }
    }
    .marked-table {
      margin-left: 16px;
      margin-bottom: 16px;

      table {
        border-collapse:collapse;
        border: 1px solid $gray_3;
      }

      td {
        border: 1px solid $gray_3;
        padding: 8px;
      }
    }
    pre {
      margin-left: 16px;
    }
  }
}

</style>