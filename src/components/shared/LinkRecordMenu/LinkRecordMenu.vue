<template>
  <div class="link-record-menu">
    <el-popover
      ref="menu"
      :visible="menuOpen"
      popper-class="no-padding scroll"
      placement="bottom-start"
      width="300"
      transition=""
      :visible-arrow="false"
    >
      <template #reference>
        <bf-button :disabled="datasetLocked" @click="onMenuClick">
          Link to...
        </bf-button>
      </template>
      <div v-if="showExistingFile" class="bf-menu existing-file-menu">
        <ul>
          <li>
            <a
              href="#"
              class="bf-menu-item"
              @click.prevent="onMenuClick('files')"
            >
              Files or folders
            </a>
          </li>
        </ul>
      </div>

      <div class="scroll-wrap">
        <div class="bf-menu scroll-menu">
          <div
            v-if="
              modelsWithRecords.length === 0 &&
              modelsWithoutRecords.length === 0
            "
            class="empty-state"
          >
            <img
              class="mb-16"
              src="/src/assets/images/illustrations/illo-missing-relationships.svg"
              alt=""
              width="120"
              height="80"
            />
            <p>
              Set up
              <router-link :to="{ name: 'relationships' }">
                relationship types
              </router-link>
              for your models to enable linking metadata records.
            </p>
          </div>
          <ul v-else>
            <li v-for="model in modelsWithRecords" :key="model.id">
              <a
                href="#"
                class="bf-menu-item"
                @click.prevent="onMenuClick(model.id)"
              >
                {{ model.displayName }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import { prop, uniqBy, reject, propEq } from "ramda";

import BfButton from "../bf-button/BfButton.vue";

export default {
  name: "LinkRecordMenu",

  components: {
    BfButton,
  },

  props: {
    relationships: {
      type: Array,
      default: function () {
        return [];
      },
    },
    showExistingFile: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      menuOpen: false,
    };
  },

  computed: {
    ...mapState(["concepts"]),

    ...mapGetters(["getModelByName", "datasetLocked"]),

    modelsHasLoaded: function () {
      return this.concepts.length > 0;
    },

    hasRelationships: function () {
      return this.relationships.length > 0;
    },

    models: function () {
      if (this.modelsHasLoaded && this.hasRelationships) {
        const relationships = reject(
          propEq("name", "package"),
          this.relationships
        );
        return relationships.map((rel) => this.getModelByName(rel.name));
      }

      return [];
    },

    /**
     * Compute direction of the dropdown arrow based on open state
     * @returns {String}
     */
    arrowDir: function () {
      return this.menuOpen ? "up" : "down";
    },

    /**
     * Compute list of all models with records
     * @returns {Array}
     */
    modelsWithRecords: function () {
      if (this.modelsHasLoaded && this.hasRelationships) {
        const modelsWithRecords = this.models.filter(
          (model) => model.count > 0
        );
        return uniqBy(prop("displayName"), modelsWithRecords);
      }

      return [];
    },

    /**
     * Compute list of all models without records
     * @returns {Array}
     */
    modelsWithoutRecords: function () {
      if (this.modelsHasLoaded && this.hasRelationships) {
        const modelsWithoutRecords = this.models.filter(
          (model) => model.count === 0
        );
        return uniqBy(prop("displayName"), modelsWithoutRecords);
      }

      return [];
    },
  },

  methods: {
    /**
     * On menu click, close menu and emit event about option clicked
     * @param {String} command
     */
    onMenuClick: function (command) {
      if (this.menuOpen) {
        this.$emit("menu-click", command);
      }
      this.menuOpen = !this.menuOpen;
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.existing-file-menu {
  border-bottom: 1px solid theme.$gray_2;
}
.empty-state {
  padding: 24px;
  text-align: center;
  p {
    margin: 0;
  }
}
</style>
