<template>
  <div class="model-details">
    <div v-if="!isEmpty" class="processor-details">
      <bf-button @click="handleLogsClick">View Logs</bf-button>
      <div class="processor-item">
        <span class="label">Name: </span>
        <span class="value">{{ selectedProcessor.name }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Description: </span>
        <span class="value">{{ selectedProcessor.description }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Status: </span>
        <span class="value">{{ selectedProcessor.status }}</span>
      </div>
    </div>
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
import { mapActions } from "vuex";

export default {
  name: "ProcessorDetails",
  components: {},
  mixins: [],

  emits: [],

  props: {
    selectedProcessor: {
      type: Object,
      default: () => ({}),
    },
  },

  data: function () {
    return {};
  },

  computed: {
    isEmpty() {
      return Object.keys(this.selectedProcessor).length === 0;
    },
  },

  methods: {
    ...mapActions("analysisModule", ["showActivityLogDialog"]),
    handleLogsClick() {
      this.showActivityLogDialog();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.model-details {
  margin: 30px;
}

.processor-details {
  display: flex;
  flex-direction: column;
  gap: 1rem; /* Adds spacing between each element */
}

.label {
  font-weight: bold;
  color: $purple_3; /* Dark blue for the text before the colon */
}

.value {
  color: black; /* Black for the text after the colon */
  font-weight: normal;
}
.processor-item {
  font-weight: bold;
  color: darkblue;
}

.processor-value {
  font-weight: normal;
  color: inherit; /* Keep inherited text color for the values */
}

li {
  align-items: center;
  display: flex;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>
