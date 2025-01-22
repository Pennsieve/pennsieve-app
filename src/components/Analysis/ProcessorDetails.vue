<template>
  <div class="model-details">
    <div v-if="false">Hello!</div>
    <div v-else>
      <div class="img-container">
        <img
          src="/src/assets/images/illustrations/illo-empty-file-types.svg"
          class="empty-image"
          alt="No processor selected"
        />
      </div>
      <div class="img-container">
        <p class="message">No processor selected</p>
      </div>
    </div>
  </div>
</template>

<script>
import { clone, pathOr, propOr } from "ramda";
import { mapGetters } from "vuex";

export default {
  name: "ProcessorDetails",
  components: {},
  mixins: [],

  emits: [],

  props: {},

  computed: {
    ...mapGetters(),
  },

  watch: {},

  data: function () {
    return {};
  },

  methods: {},
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

h2 {
  color: $purple_3;
  margin-bottom: 4px;
  font-weight: 500;
}

.title-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px;
}

.option-dot {
  color: $purple_1;
}

.special_circle {
  display: flex;
  min-width: 10px;
}

.prop-option-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  word-wrap: normal;
  overflow-wrap: break-word;
  word-break: break-all;

  .short {
    width: 120px;
    min-width: 120px;
    font-weight: 500;
  }

  .description {
    overflow-wrap: break-word;
    word-wrap: normal;
    word-break: break-all;
  }
}

.model-details {
  padding: 8px;
}
.model-tooltip-wrap {
}

.prop-options {
  width: 20px;
  padding: 0 4px;
}

.tiny-break {
  margin: 0 0 8px 0;
}

.model-name,
ul {
  display: block;
  padding: 8px 0px;
}
.model-name {
  align-items: center;
  border-bottom: 1px solid $gray_2;
  display: flex;
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
  justify-content: space-between;
  .svg-icon {
    flex-shrink: 0;
  }
}
li {
  align-items: center;
  display: flex;
  font-size: 12px;
  margin-bottom: 8px;
}

table {
  border: none;
  border-collapse: collapse;

  :hover {
    background: $purple_tint;
    cursor: pointer;

    &.selected {
      background: $purple_tint;
    }
  }
}

.prop-table {
  margin: 0 8px;
}

.links-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: 24px;
  margin-bottom: 8px;
  align-items: center;
  color: $purple_3;
  background: $purple_tint;
  padding: 4px;

  &.first {
    margin-top: 8px;
  }
}

.add-prop-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: end;
  margin-bottom: 8px;
  align-items: end;
  color: $purple_2;
  padding: 4px;
}

.add-button {
  color: $purple_2;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.img-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-top: 24px;
}

.message {
  color: $purple_2;
  margin: 8px;
}

.model-info {
  margin: 0 0 8px 0;
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;
  padding-left: 8px;
  justify-content: start;

  .nr-props {
    display: flex;
    min-width: 120px;
  }
  .nr-records {
    display: flex;
  }
}

tr {
  &.selected {
    font-weight: 500;
  }

  td:active {
    color: $purple_2;
  }

  .empty-image {
    width: 200px;
    justify-content: center;
  }

  .prop-name {
    color: $purple_2;
    min-width: 80px;
    max-width: 110px;
    overflow: hidden;
  }

  .prop-list {
    margin: 4px 0;
    .prop-wrapper {
      display: flex;
      .prop-name {
        color: $purple_2;
        min-width: 120px;
      }
    }
  }

  .prop-unit {
    width: 100px;
  }

  .prop-type {
    width: 100px;
  }
}
</style>
