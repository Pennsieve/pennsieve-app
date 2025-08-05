<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-integration-dialog fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Create Application" />
    </template>

    <dialog-body>
      <el-form
        :model="application"
        :rules="rules"
        label-position="top"
        ref="form"
        @submit.native.prevent="handleCreateApplication"
      >
        <el-form-item prop="name">
          <template #label>
            Name <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.name"
            placeholder="my-analysis-application"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="description">
          <template #label>
            Description <span class="label-helper"> required </span>
          </template>
          <div class="text-area-wrapper">
            <el-input
              ref="input"
              v-model="application.description"
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a description to help others understand what the application does"
              :show-word-limit="true"
            />
          </div>
        </el-form-item>

        <el-form-item prop="applicationType">
          <template #label>
            Application Type <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.applicationType"
            class="input-property"
            filterable
            placeholder="Choose an application type"
          >
            <el-option
              v-for="item in typeItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item prop="resources.cpu">
          <template #label>
            CPU <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.resources.cpu"
            class="input-property"
            filterable
            autofocus
            placeholder="Choose CPU"
          >
            <el-option
              v-for="item in cpuItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
            </el-select>
        </el-form-item>

        <el-form-item prop="resources.memory">
          <template #label>
            Memory <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.resources.memory"
            class="input-property"
            filterable
            autofocus
            placeholder="Select CPU before Memory"
          >
            <el-option
              v-for="item in memoryItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
            </el-select>
        </el-form-item>

        <el-form-item prop="computeNode">
          <template #label>
            Compute Node <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.computeNode"
            class="input-property"
            filterable
            placeholder="Choose a Compute Node"
          >
            <el-option
              v-for="computeNode in computeNodes"
              :key="computeNode.name"
              :label="computeNode.name"
              :value="computeNode"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item prop="parameters" id="paramsInput">
          <template #label>
            <div>
              <span > Parameters </span>
              <span class="label-helper"> optional </span>
            </div>
          </template>
        <el-table :data="application.parameters" max-height="250" :border="true">
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

        <el-form-item prop="source.type">
          <template #label>
            Source Type <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.source.type"
            class="input-property"
            filterable
            placeholder="Choose a Source Type"
          >
            <el-option
              v-for="item in sourceItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item prop="source.url">
          <template #label>
            Source URL <span class="label-helper"> required </span>
            <span class="url-format-info"> Format: github.com/owner/repo </span>
          </template>
          <el-input
            v-model="application.source.url"
            placeholder="github.com/owner/repo"
            autofocus
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <!-- Overview buttons -->
    <template #footer>
      <bf-button @click="handleCreateApplication">
        Create Application
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import EventBus from "../../../utils/event-bus";
import { CircleClose, Plus } from "@element-plus/icons-vue";


/**
 * Returns the default values for a property
 * @returns {Object}
 */
const defaultApplicationFormValues = () => ({
  name: "",
  description: "",
  applicationType: "",
  resources: {
    cpu: "",
    memory: "",
  },
  computeNode: {
    value: "",
    label: "",
    uuid: "",
    efsId: "",
  },
  source: {
    type: "",
    url: "",
  },
  parameters: [],
});

export default {
  name: "CreateApplicationDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
    Plus,
    CircleClose
  },

  props: {
    dialogVisible: Boolean,
  },

  data() {
    return {
      application: defaultApplicationFormValues(),
      typeItems: [
        {
          value: "processor",
          label: "Processor",
        },
        {
          value: "preprocessor",
          label: "Preprocessor",
        },
        {
          value: "postprocessor",
          label: "Postprocessor",
        },
      ],
      cpuItems:[
        {
          value: 1024,
          label: "1 CPU",
        },
        {
          value: 2048,
          label: "2 CPU",
        },
        {
          value: 4096,
          label: "4 CPU",
        },
        {
          value: 8192,
          label: "8 CPU",
        }
      ],
      memoryItems:[],
      //form memory options in GB, maps to cpu value above. Keeping unsurfaced values for future options. 
      memoryItemMap: new Map([
        [256,{"start":1,"end":2,"i":1}],
        [512,{"start":1,"end":4,"i":1}],
        [1024,{"start":2,"end":8,"i":1}],
        [2048,{"start":4,"end":16,"i":1}],
        [4096,{"start":8,"end":30,"i":1}],
        [8192,{"start":16,"end":60,"i":4}],
        [16384,{"start":32,"end":120,"i":8}]

      ]),
      sourceItems: [
        {
          value: "github",
          label: "Github",
        },
      ],
      rules: {
        name: [
          {
            required: true,
            message: "Please input the application name",
            trigger: "blur",
          },
          {
            max: 50,
            message: "Name cannot exceed 50 characters",
            trigger: "blur",
          },
        ],
        description: [
          {
            required: true,
            message: "Please input the description",
            trigger: "blur",
          },
        ],
        applicationType: [
          {
            required: true,
            message: "Please select an application type",
            trigger: "change",
          },
        ],
        "resources.cpu": [
          { required: true, message: "Please input the CPU", trigger: "blur" },
        ],
        "resources.memory": [
          {
            required: true,
            message: "Please input the memory",
            trigger: "blur",
          },
        ],
        computeNode: [
          { validator: this.validateComputeNode, trigger: "change" },
        ],
        "source.type": [
          {
            required: true,
            message: "Please input the source type",
            trigger: "change",
          },
        ],
        "source.url": [
          {
            required: true,
            message: "Please input the source URL",
            trigger: "blur",
          },
          {
            pattern: "^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$",
            message: "Source URL must be in the format github.com/owner/repo",
            trigger: "blur",
          },
        ],
      },
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["computeNodes"])
  },
    watch:{
      "application.resources.cpu": {
      handler: function(val) {
        const vm = this;
        createMemoryItems(val,vm);
      },
      immediate: true
    }
    },
  mounted() {
    this.fetchComputeNodes();
  },

  methods: {
    ...mapActions("analysisModule", ["fetchComputeNodes", "createApplication"]),
    validateComputeNode(rule, value, callback) {
      if (!value || !value.uuid) {
        callback(new Error("Please select a compute node"));
      } else {
        callback();
      }
    },

    /**
     * Closes the dialog
     */
    closeDialog() {
      this.$emit("close", false);
      this.application = defaultApplicationFormValues();
      this.$refs.form.clearValidate();
    },

    addParameterRow() {
      this.application.parameters.push({name: null, value: null});
    },

    deleteParameterRow(index) {
      this.application.parameters.splice(index,1)
    },

    getApplicationParams() {
      if (this.application.parameters.length > 0) {
        let paramsEntries = []
        this.application.parameters.forEach((param) => {
          paramsEntries.push([param.name, param.value])
        })
        let paramsObject = Object.fromEntries(paramsEntries)
        return paramsObject
      } else {
        return null
      }
    },

    /**
     * POST to API to create new application
     */
    async handleCreateApplication() {
      this.$refs.form.validate(async (valid) => {
        if (valid) {
          const accountDetails = {
            uuid: this.application.computeNode.account.uuid,
            accountId: this.application.computeNode.account.accountId,
            accountType: this.application.computeNode.account.accountType,
          };
          const computeNodeDetails = {
            uuid: this.application.computeNode.uuid,
            efsId: this.application.computeNode.efsId,
          };
          const formattedResources = {
            cpu: Number(this.application.resources.cpu),
            memory: Number(this.application.resources.memory),
          };
          const formattedSource = {
            type: this.application.source.type,
            url: `git://${this.application.source.url}`,
          };

          const formattedParams = this.getApplicationParams()

          const formattedNewApplication = {
            ...this.application,
            account: accountDetails,
            computeNode: computeNodeDetails,
            resources: formattedResources,
            source: formattedSource,
            params: formattedParams,
          };

          // remove formattedNewApplication.parameters ('params' is what is stored)
          delete formattedNewApplication.parameters

          try {
            await this.createApplication(formattedNewApplication);
            EventBus.$emit("toast", {
              detail: {
                type: "success",
                msg: "Your request has been successfully submitted.",
              },
            });
          } catch (error) {
            console.error(error);
            EventBus.$emit("toast", {
              detail: {
                type: "error",
                msg: "There was a problem submitting your request.",
              },
            });
          } finally {
            this.closeDialog();
          }
        }
      });
    },
  },
};


function createMemoryItems(cpu, comp) {
  if (!cpu || !comp) return;

  const memVars = comp.memoryItemMap.get(cpu);
  if (!memVars) return;

  const { start, end, i } = memVars;
  const memoryArray = [];

  if (cpu === 256) {
    memoryArray.push({ value: 512, label: "512 MiB" });
  }

  for (let value = start; value <= end; value += i) {
    memoryArray.push({ value:value*1024, label: value.toString()+" GB" });
  }

  comp.memoryItems = memoryArray;
}
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.text-area-wrapper {
  width: 100%;
}

.add-integration-dialog {
  .el-form-item {
    .el-form-item__label {
      font-weight: 500;
      color: theme.$gray_5;
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
    border: 1px solid theme.$gray_5;
  }

  .el-checkbox__label,
  .el-form-item__label {
    color: theme.$gray_6;
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
    color: theme.$gray_4;
    line-height: 16px;
  }
  .info {
    font-size: 12px;
    color: theme.$gray_4;
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

  .url-format-info {
    display: block;
    font-size: 12px;
    color: theme.$gray_6;
    margin-top: 4px;
  }

  .url-format-info a {
    color: theme.$primary-color;
    text-decoration: none;
  }

  .url-format-info a:hover {
    text-decoration: underline;
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

<style lang="scss">
#paramsInput {
  .el-form-item__content {
    border: 1px solid #e5e5e5;
  }

  .cell {
    white-space: normal;
    max-height: unset;
  }

  .el-table .el-table__body td.el-table__cell {
    border-right: 1px solid #e5e5e5
  }

  .el-table {
    border-collapse: collapse;
  }

}

</style>
