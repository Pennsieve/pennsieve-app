<template>
  <div>
    <div v-if="showHeader" class="help-title-wrapper">
      <div class="help-title">{{ docTitle }}</div>
      <a href="https://docs.pennsieve.io" class="link-item">
        <IconUpload :width="14" :height="14" style="margin-right: 4px; transform: rotate(90deg) scaleX(-1)"/>
        <div class="person-circle">
          Documentation Hub
        </div>
      </a>
    </div>
    <slot name="pre"/>
    <div
      class='help-section'
      v-html="docContent"
    />
  </div>
</template>

<script>
import Request from "../../../mixins/request";
import {mapGetters} from "vuex";
import {propOr} from "ramda";
import IconUpload from "../../icons/IconUpload.vue";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'ReadmeDoc',

  components: {
    IconUpload
  },

  props: {
    slug: {
      type: String,
      default: ''
    },
    showHeader: {
      type: Boolean,
      default: false
    }
  },

  watch: {
    packageDetailsUrl: {
      handler: function(val) {
        if (val) {
          this.getInstanceDetails()
        }
      },
      immediate: true
    },

    slug: {
      handler: function(val){
        if (val){
          this.getReadmeDocument(val)
        }

      },
      immediate: true
    }
  },

  mixins: [
    Request
  ],

  computed: {
    ...mapGetters([
      "config",
    ]),

    docTitle: function() {
      return propOr('', 'excerpt', this.content)
    },
    docContent: function() {
      return propOr('', 'body_html', this.content)
    }
  },

  data() {
    return {
      content: {},
    }
  },

  methods: {
    getReadmeDocument: async function(val) {

      useGetToken()
        .then(token => {
          const url = `${this.config.api2Url}/readme/docs/${val}`
          this.sendXhr(url, {
            method: 'GET',
            header: {
              'Authorization': `Bearer ${token}`
            },
          }).then( result => {
            this.content = result
          })
        })
    }
  }
}

</script>

<style lang="scss" scoped>
@use '../../../styles/theme';

.help-title-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px;
  background-color: theme.$purple_tint;

  .help-title {
    color: theme.$purple_3;
    font-size: 12pt;
    margin: 8px 0px;

  }
}

.link-item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.help-section {
  padding: 8px;
  border-radius: 4px;

  :deep(.header-scroll) {
    color: theme.$purple_2;
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
        border: 1px solid theme.$gray_3;
      }

      td {
        border: 1px solid theme.$gray_3;
        padding: 8px;
      }
    }
    pre {
      margin-left: 16px;
    }
  }
}

</style>
