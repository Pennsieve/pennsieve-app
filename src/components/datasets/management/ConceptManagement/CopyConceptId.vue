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

    <el-tooltip
      placement="top"
      :content="tooltipContent"
      :value="visibility"
      :manual="true"
    >
      <el-input
        class="concept-id-field"
        :disabled="true"
        :value="conceptId"
      >
        <template #suffix>
          <i
            class="copy-icon-wrapper"
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
          </i>
        </template>

      </el-input>
    </el-tooltip>
  </sidebar-message>
</template>

<script>
import SidebarMessage from '../../../shared/SidebarMessage/SidebarMessage.vue'
import IconDocument from "../../../icons/IconDocument.vue";

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
      this.$clipboard(this.conceptId)
      this.displayMessage()
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
    width: 264px;
  }

  .copy-icon-wrapper {
    background: $purple_1;
    border: solid 1px transparent;
    border-radius: 0 2px 2px 0;
    cursor: pointer;
    width: 34px;
    height: 38px;
    line-height: 34px;
    text-align: center;
    position: absolute;

    .copy-icon-button {
      height: 100%;
      width: 100%;
    }

    &:hover {
      background: $purple_3;
    }
  }
</style>
