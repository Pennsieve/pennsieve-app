<template>
  <sidebar-message
    class="copy-concept-id"
    title="Model Id"
  >
    <template #copy>
      <p>
        You can use the ID or name to access this model type and related data using the API.
      </p>
    </template>


      <div class="concept-id-field">
        <div class="concept-id">
          {{conceptId}}
        </div>
        <el-tooltip
          placement="top"
          content="Copy Model ID"
          :value="visibility"
          :manual="true"
        >
          <button
            class="copy-icon-button"
            @click="copyId"
          >
            <IconDocument
              :height="20"
              :width="20"
            />
          </button>
        </el-tooltip>

      </div>

  </sidebar-message>
</template>

<script>
import SidebarMessage from '../../../shared/SidebarMessage/SidebarMessage.vue'
import IconDocument from "../../../icons/IconDocument.vue";
import EventBus from "../../../../utils/event-bus";
import {copyText} from "vue3-clipboard";


export default {
  name: 'CopyConceptId',

  components: {
    IconDocument,
    SidebarMessage
  },

  props: {
    conceptId: {
      type: String,
      default: ''
    },
  },

  data() {
    return {
      visibility: false,
    }
  },

  computed: {
    /**
     * Computes copy success message
     * @returns {String}
     */
    tooltipContent: function() {
      return `'${this.conceptId}' copied!`
    }
  },

  methods: {
    /**
     * Copies the concept id to clipboard
     */
    copyId: function() {
      copyText(this.conceptId)
      EventBus.$emit('toast', {
        detail: {
          msg: 'Model ID copied to clipboard',
          type: 'success'
        }
      })
    },
    /**
     * Displays success copy message for 2s
     */
    displayMessage: function() {
      this.visibility = true
      setTimeout(() => {
        this.visibility = false
      }, 2000)
    },
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/variables';

  .copy-concept-id {
    p {
      margin-bottom: 24px;
    }
  }

  .concept-id-field {
    height: 40px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;

    .concept-id {
      color: $purple_2;
      font-size: medium;
    }

    .copy-icon-button {
      height: 100%;
      color: $purple_3;

      &:hover {
        color: $purple_2;
      }
    }
  }
</style>
