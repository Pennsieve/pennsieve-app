<template>
  <el-dialog :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="edit-application-dialog">
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
      <bf-button @click="confirmUpdateApplicationParams">
        Confirm changes
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
      } else {
        return []
      }
    },

    confirmUpdateApplicationParams() {
      let payload = this.application
      payload.params = this.formatParamsForPayload()
      this.$emit('confirm-edit', payload)
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

.dialog-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}
</style>

<style lang="scss">
.edit-application-dialog {
  .el-form-item {
    .el-form-item__label {
      font-size: 18px;
    }
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
  }
  #addParamButtonWrapper {
    width: 100%;
    text-align: center;
    margin: 8px 24px;

    .el-button {
      width: 100%;
    }
  }
}
</style>
