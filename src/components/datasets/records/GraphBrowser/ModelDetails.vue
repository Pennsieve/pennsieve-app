<template>
  <div class="model-details">
    <div v-if="modelId">
      <div v-if="Object.keys(curModel).length" class="model-tooltip-wrap">
        <div class="title-wrapper">
          <h2>
            {{ curModel.displayName }}
          </h2>
          <button class="add-button" @click="openDeleteModelDialog">
            <IconDelete :height="18" :width="18" />
          </button>
        </div>

        <div class="model-info">
          <div class="nr-props">
            <IconInfo class="mr-8" :height="16" :width="16" />
            <span>{{ propertyLabel }}</span>
          </div>
          <div class="nr-records">
            <IconDocument class="mr-8" :height="16" :width="16" />
            <span>{{ recordLabel }}</span>
          </div>
        </div>

        <div class="add-prop-wrapper">
          <button
            v-if="!isAnySelected"
            class="add-button"
            @click="openPropertyDialog"
          >
            <IconPlus :height="12" :width="12" />
            <u>Add Property</u>
          </button>

          <button
            v-if="isAPropSelected"
            class="add-button"
            @click="openEditPropDialog"
          >
            <IconDocument :height="14" :width="14" />
            <u>Edit </u>
          </button>
          <button
            v-if="isAPropSelected"
            class="add-button"
            @click="openDeletePropDialog"
          >
            <IconDelete :height="14" :width="14" />
            <u>Remove </u>
          </button>
          <button
            v-if="isALinkedPropSelected"
            class="add-button"
            @click="openDeleteLinkedPropDialog"
          >
            <IconDelete :height="14" :width="14" />
            <u>Remove </u>
          </button>
          <button
            v-if="isARelationshipSelected"
            class="add-button"
            @click="openDeleteRelationshipDialog"
          >
            <IconDelete :height="14" :width="14" />
            <u>Remove </u>
          </button>
        </div>
        <div class="links-wrapper first">
          <div>Model Properties</div>
          <el-popover
            placement="top-start"
            title="Property information"
            :width="400"
            trigger="hover"
            :show-after="700"
          >
            <template #reference>
              <IconInfo></IconInfo>
            </template>

            <template #default>
              Add properties to the selected model. Drag a connection between
              models in the visualizer to create a property that points to a
              <b>single record</b> of another model.
            </template>
          </el-popover>
        </div>

        <div class="prop-table">
          <table>
            <tr
              v-for="(item, index) in viewProps"
              @click="clickRow"
              :prop-id="index"
              :class="[item.selected ? 'selected' : '']"
            >
              <td>
                <div class="special_circle">
                  <IconXCircle
                    class="option-dot"
                    :width="10"
                    v-if="item.conceptTitle"
                  />
                </div>
              </td>
              <el-popover
                placement="top-start"
                title="Property information"
                :width="400"
                trigger="hover"
                :show-after="700"
              >
                <template #reference>
                  <td class="prop-name">{{ item.displayName }}</td>
                </template>

                <template #default>
                  <div>
                    <div class="prop-option-row">
                      <div class="short">Property Name</div>
                      <div class="description">{{ item.name }}</div>
                    </div>
                  </div>
                  <div v-if="item.conceptTitle">
                    <div class="prop-option-row">
                      <div class="short">Is Primary</div>
                      <div class="description">
                        This property is shown as the link to the record
                      </div>
                    </div>
                  </div>
                  <div v-if="item.required">
                    <div class="prop-option-row">
                      <div class="short">Is Required</div>
                      <div class="description">
                        A record will fail validation if this property is not
                        set
                      </div>
                    </div>
                  </div>

                  <div v-if="isEnumProp(item)">
                    <div class="prop-option-row">
                      <div class="short">Enum</div>
                      <div class="description">
                        A limited set of values are valid for this property
                      </div>
                    </div>
                  </div>
                </template>
              </el-popover>

              <td class="prop-unit">{{ propUnitStr(item) }}</td>

              <td class="prop-type">{{ formatType(item.dataType) }}</td>
            </tr>
            <tr
              v-for="(item, index) in linkedProps"
              @click="clickLinkedPropRow"
              :prop-id="index"
              :class="[item.selected ? 'selected' : '']"
            >
              <td>
                <div style="display: flex">
                  <IconXCircle
                    class="option-dot"
                    :width="10"
                    v-if="item.conceptTitle"
                  />
                </div>
              </td>
              <td class="prop-name">{{ item.displayName }}</td>
              <td class="prop-unit"></td>
              <td class="prop-type">{{ formatToModel(item.to) }}</td>
            </tr>
          </table>
        </div>

        <div class="links-wrapper">
          <div>Model Relationships</div>
          <el-popover
            placement="top-start"
            title="Relationship information"
            :width="400"
            trigger="hover"
            :show-after="700"
          >
            <template #reference>
              <IconInfo></IconInfo>
            </template>

            <template #default>
              Relationships link models by enabling <b>any number</b> of records
              of model A to link to <b>any number</b> of records of model B. Use
              the visualizer to connect models that should be linked.
            </template>
          </el-popover>
        </div>

        <div class="prop-table">
          <table>
            <tr
              v-for="(item, index) in relationships"
              @click="clickRelationship"
              :prop-id="index"
              :class="[item.selected ? 'selected' : '']"
            >
              <td>
                <div class="special_circle">
                  <IconXCircle
                    class="option-dot"
                    :width="10"
                    v-if="item.conceptTitle"
                  />
                </div>
              </td>
              <td class="prop-name">{{ item.displayName }}</td>
              <td class="prop-unit"></td>

              <td class="prop-type">{{ formatToModel(item.to) }}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
    <div v-else>
      <div class="img-container">
        <img
          src="/src/assets/images/illustrations/illo-empty-file-types.svg"
          class="empty-image"
          alt="No model selected"
        />
      </div>
      <div class="img-container">
        <p class="message">No model selected</p>
      </div>
    </div>
  </div>
</template>

<script>
import { clone, pathOr, propOr } from "ramda";

import Pluralizer from "../../../../mixins/Pluralizer/index";
import IconArrowUp from "../../../icons/IconArrowUp.vue";
import IconArrowRight from "../../../icons/IconArrowRight.vue";
import IconDocument from "../../../icons/IconDocument.vue";
import IconInfo from "../../../icons/IconInfo.vue";
import { mapGetters } from "vuex";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import IconRemove from "@/components/icons/IconRemove.vue";
import IconPlus from "@/components/icons/IconPlus.vue";
import IconMinimize from "@/components/icons/IconMinimize.vue";
import IconDelete from "@/components/icons/IconDelete.vue";
import IconCenter from "@/components/icons/IconCenter.vue";
import IconColor from "@/components/icons/IconColor.vue";
import IconGuide from "@/components/icons/IconGuide.vue";
import IconXCircle from "@/components/icons/IconXCircle.vue";

export default {
  name: "ModelDetails",
  components: {
    IconXCircle,
    IconGuide,
    IconColor,
    IconCenter,
    IconDelete,
    IconMinimize,
    IconPlus,
    IconRemove,
    IconAddTemplate,
    BfButton,
    IconInfo,
    IconDocument,
    IconArrowRight,
    IconArrowUp,
  },
  mixins: [Pluralizer],

  emits: [
    "openPropertyDialog",
    "openDeletePropertyDialog",
    "openDeleteLinkedPropDialog",
    "openDeleteRelationshipDialog",
    "openDeleteModelDialog",
    "openEditPropertyDialog",
  ],

  props: {
    modelId: {
      type: String,
      default: "",
    },
    edges: {
      type: Array,
      default: [],
    },
  },

  computed: {
    ...mapGetters("metadataModule", ["getModelById"]),

    linkedProps: function () {
      let lp = [];
      for (let e in this.edges) {
        if (
          this.edges[e].from === this.modelId &&
          this.edges[e].type === "schemaLinkedProperty"
        ) {
          lp.push(this.edges[e]);
        }
      }
      return lp;
    },
    relationships: function () {
      let rel = [];
      for (let e in this.edges) {
        if (
          this.edges[e].from === this.modelId &&
          this.edges[e].type === "schemaRelationship"
        ) {
          rel.push(this.edges[e]);
        }
      }
      return rel;
    },

    isAPropSelected: function () {
      for (let p in this.viewProps) {
        if (this.viewProps[p].selected) {
          return true;
        }
      }
      return false;
    },
    isALinkedPropSelected: function () {
      for (let p in this.linkedProps) {
        if (this.linkedProps[p].selected) {
          return true;
        }
      }
      return false;
    },
    isARelationshipSelected: function () {
      for (let p in this.relationships) {
        if (this.relationships[p].selected) {
          return true;
        }
      }
      return false;
    },

    isAnySelected: function () {
      for (let p in this.viewProps) {
        if (this.viewProps[p].selected) {
          return true;
        }
      }
      for (let p in this.linkedProps) {
        if (this.linkedProps[p].selected) {
          return true;
        }
      }
      for (let p in this.relationships) {
        if (this.relationships[p].selected) {
          return true;
        }
      }

      return false;
    },

    selectedRow: function () {
      for (let p in this.viewProps) {
        if (this.viewProps[p].selected) {
          return this.viewProps[p];
        }
      }
      for (let p in this.linkedProps) {
        if (this.linkedProps[p].selected) {
          return this.linkedProps[p];
        }
      }
      for (let p in this.relationships) {
        if (this.relationships[p].selected) {
          return this.relationships[p];
        }
      }

      return null;
    },

    curModel: function () {
      const m = this.getModelById(this.modelId);
      if (m) {
        return m;
      } else {
        return {};
      }
    },

    /**
     * Compute the label for records
     * @returns {String}
     */
    recordLabel: function () {
      const count = propOr(0, "count", this.curModel);

      return this.pluralizer(count, "Record", "Records");
    },

    /**
     * Compute the label for properties
     * @returns {String}
     */
    propertyLabel: function () {
      const count = propOr(0, "propertyCount", this.curModel);
      const count2 = this.linkedProps.length;

      return this.pluralizer(count + count2, "Property", "Properties");
    },

    /**
     * Computes the model search link
     * @return {Object | String}
     */
    modelSearchLink: function () {
      const modelId = propOr("", "id", this.curModel);

      return {
        name: "model-details",
        params: { modelId: modelId },
      };
    },
  },

  watch: {
    curModel: {
      handler: function (val) {
        this.viewProps = [];
        for (let p in this.curModel.props) {
          this.viewProps.push({
            ...clone(this.curModel.props[p]),
            selected: false,
          });
        }
      },
      immediate: true,
      deep: true,
    },
  },

  data: function () {
    return {
      viewProps: [],
    };
  },

  methods: {
    openEditPropDialog: function () {
      this.$emit("openEditPropertyDialog", { property: this.selectedRow });
    },
    openDeleteModelDialog: function () {
      this.$emit("openDeleteModelDialog");
    },
    openDeleteRelationshipDialog: function () {
      this.$emit("openDeleteRelationshipDialog", {
        property: this.selectedRow,
      });
    },
    openDeleteLinkedPropDialog: function () {
      this.$emit("openDeleteLinkedPropDialog", { property: this.selectedRow });
    },
    openDeletePropDialog: function () {
      this.$emit("openDeletePropertyDialog", { property: this.selectedRow });
    },
    propUnitStr: function (prop) {
      return pathOr("", ["dataType", "unit"], prop);
    },
    isEnumProp: function (prop) {
      const type = propOr(null, "type", prop.dataType);
      return type === "enum";
    },
    formatToModel: function (value) {
      let m = this.getModelById(value);
      return m.displayName;
    },
    formatType: function (value) {
      if (typeof value === "string") {
        return value;
      } else if (value.type === "array") {
        const type = pathOr("", ["items", "type"], value);
        return "[ ] " + type;
      } else {
        return value.type;
      }
    },
    openPropertyDialog: function () {
      this.$emit("openPropertyDialog");
    },
    clickRelationship: function (event) {
      const prevState =
        this.relationships[event.currentTarget.attributes["prop-id"].value]
          .selected;

      for (let p in this.viewProps) {
        this.viewProps[p].selected = false;
      }
      for (let p in this.linkedProps) {
        this.linkedProps[p].selected = false;
      }
      for (let p in this.relationships) {
        this.relationships[p].selected = false;
      }

      this.relationships[
        event.currentTarget.attributes["prop-id"].value
      ].selected = !prevState;
    },
    clickLinkedPropRow: function (event) {
      const prevState =
        this.linkedProps[event.currentTarget.attributes["prop-id"].value]
          .selected;

      for (let p in this.linkedProps) {
        this.linkedProps[p].selected = false;
      }
      for (let p in this.viewProps) {
        this.viewProps[p].selected = false;
      }
      for (let p in this.relationships) {
        this.relationships[p].selected = false;
      }

      this.linkedProps[
        event.currentTarget.attributes["prop-id"].value
      ].selected = !prevState;
    },
    clickRow: function (event) {
      const prevState =
        this.viewProps[event.currentTarget.attributes["prop-id"].value]
          .selected;
      for (let p in this.viewProps) {
        this.viewProps[p].selected = false;
      }
      for (let p in this.linkedProps) {
        this.linkedProps[p].selected = false;
      }
      for (let p in this.relationships) {
        this.relationships[p].selected = false;
      }

      this.viewProps[event.currentTarget.attributes["prop-id"].value].selected =
        !prevState;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

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
