<template>
  <el-dialog :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event">
    <template #header>
      <bf-dialog-header slot="title" title="Edit Application" />
    </template>

    <dialog-body>
      <el-form-item prop="parameters" id="paramsInput">
          <template #label>
            <div>
              <span> Parameters</span>
            </div>
          </template>
        <el-table :data="applicationParams" max-height="250" :border="true">
          <el-table-column label="Name">
            <template #default="scope">
              <el-input
                v-model="scope.row.name"
                placeholder="Enter name"
                maxlength="50"
                show-word-limit
                type="text"
              ></el-input>
            </template>
          </el-table-column>
          <el-table-column label="Value">
            <template #default="scope">
              <el-input
                v-model="scope.row.value"
                placeholder="Enter value"
                maxlength="50"
                show-word-limit
                type="text"
              ></el-input>
            </template>
          </el-table-column>
          <el-table-column width="70">
            <template #default="scope">
              <el-button
                :size="'default'"
                @click.prevent="deleteParameterRow(scope.$index)"
              >
                <el-icon>
                  <CircleClose />
                </el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div id="addParamButtonWrapper">
            <el-button @click="addParameterRow" type="primary" plain>Add param<el-icon class="el-icon--right"><Plus /></el-icon></el-button>
        </div>
        </el-form-item>
    </dialog-body>

    <template #footer>
      <bf-button @click="editApplication">
        Update application params
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState } from "vuex";

import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import { CircleClose, Plus } from "@element-plus/icons-vue";


/**
 * Returns the default values for a property
 * @returns {Object}
 */

export default {
  name: "EditApplicationDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
    CircleClose,
    Plus
  },

  mixins: [],

  props: {
    application: {
      type: Object,
      required: true,
      default: () => ({})
    },
    dialogVisible: Boolean
  },
  mounted: function () {},
  data: function () {
    return {
      applicationParams: this.formatParamsForUI(this.application)
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
  },

  watch: {
    application(newValue) {
      this.applicationParams = this.formatParamsForUI(newValue)
    }
  },

  methods: {
    addParameterRow() {
      console.log('clicked')
      this.applicationParams.push({name: null, value: null});
    },

    deleteParameterRow(index) {
      this.applicationParams.splice(index,1)
    },

    formatParamsForUI(application) {
      if (application && application.params) {
        let params = []
        for (const [key, value] of Object.entries(application.params)) {
          params.push({'name': key, 'value': value})
        }
        return params
      }
    },

    editApplication() {
      let payload = this.application
      payload.params = this.formatParamsForPayload()
      this.$emit('edit-application', payload)
    },

    formatParamsForPayload() {
      if (this.applicationParams.length > 0) {
        let paramsEntries = []
        this.applicationParams.forEach((param) => {
          paramsEntries.push([param.name, param.value])
        })
        let paramsObject = Object.fromEntries(paramsEntries)
        return paramsObject
      } else {
        return null
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.text-area-wrapper {
  width: 100%;
}

.add-integration-dialog {
  .el-form-item {
    .el-form-item__label {
      font-weight: 500;
      color: $gray_5;
    }
  }

  .el-select {
    &.input-property {
      width: 100%;

      &.target {
        max-width: 200px;
        margin-right: 8px;
      }

      &.filter {
        margin-right: 8px;
      }
    }
  }

  .item-field {
    margin-bottom: 24px;
    &.has-enums {
      margin-bottom: 14px;
    }
  }

  .el-checkbox {
    &.input-property {
      width: 100%;
    }
  }

  .check-description {
    margin-left: 25px;
    line-height: 1em;
  }
  .el-checkbox__inner {
    border: 1px solid $gray_5;
  }

  .el-checkbox__label,
  .el-form-item__label {
    color: $gray_6;
    font-weight: 400;
  }

  .targetOptions {
    flex-direction: row;
    display: flex;
    margin: 8px 0;
  }

  .disabled-label {
    color: #c0c4cc;
    cursor: not-allowed;
    margin-top: 10px;
  }

  .label {
    margin-top: 10px;
  }

  .el-select-group,
  .el-select-dropdown__item {
    padding-bottom: 10px;
  }
  .item-checkbox .el-form-item__content {
    line-height: 1em;
  }
  #item-concept-title {
    #current-name {
      margin-left: 24px;
    }
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    line-height: 16px;
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    &.disabled-label {
      color: #c0c4cc;
      cursor: not-allowed;
      margin-top: -18px;
      height: 26px;
      margin-left: 25px;
    }
  }
  .el-form-item {
    .el-form-item__label {
      text-align: left;
    }
  }
  .el-dialog {
    height: auto;
    width: 524px;
  }
  .el-dialog__footer {
    width: 100%;
  }
  .string-sub-type {
    display: flex;
    flex-direction: row;
  }
}
</style>
