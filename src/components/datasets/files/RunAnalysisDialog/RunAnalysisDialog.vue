<template>
  <el-dialog
    :modelValue="dialogVisible"
    data-cy="runAnalysisDialog"
    :show-close="true"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" :title="dialogTitle" />
    </template>

    <dialog-body>
      <!-- Step 1 -->
      <el-form
        v-show="shouldShow(1, 'All')"
        ref="integrationFormStep1"
        :model="integration"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="createIntegration"
      >
        <el-form-item prop="displayName">
          <template #label>
            Name <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="integration.displayName"
            placeholder="For example: Slack, MyExternalService"
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
              v-model="integration.description"
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a description to help others understand what the integration does."
              :show-word-limit="true"
            />
          </div>
        </el-form-item>

        <el-form-item prop="isPublic">
          <template #label>
            Integration permissions <span class="label-helper"> </span>
            <div class="info">
              Allow the integration to be used by everyone in the organization.
              By default the integration is private and can only be managed by
              the current user.
            </div>
          </template>
          <el-checkbox
            v-model="integration.isPublic"
            label="Enable organization-wide use of integration"
          />
        </el-form-item>

        <el-form-item prop="isDefault" v-show="integration.isPublic">
          <template #label>
            Enable by default <span class="label-helper"> </span>
            <div class="info">
              Enable this integration for all new datasets added to your
              organization. Individual dataset owners can opt-out or turn off.
            </div>
          </template>
          <el-checkbox
            v-model="integration.isDefault"
            label="Enable by default on new datasets"
          />
        </el-form-item>
      </el-form>

      <!-- Step 2 -->
      <div class="form-container" v-show="shouldShow(2, 'All')">
        <el-form
          ref="integrationFormStep2"
          label-position="top"
          :model="integration"
          :rules="rules"
        >
          <el-form-item prop="integrationType">
            <template #label>
              Integration Type <span class="label-helper"> required </span>
            </template>
            <el-select
              ref="enum"
              v-model="integration.integrationType"
              class="input-property"
              filterable
            >
              <el-option
                v-for="item in typeItems"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item prop="apiUrl">
            <template #label>
              API URL <span class="label-helper"> required </span>
            </template>
            <el-input
              v-model="integration.apiUrl"
              placeholder="http://<myhost>/<webhook-route>"
            />
          </el-form-item>

          <el-form-item prop="imageUrl">
            <template #label>
              Image URL <span class="label-helper"> optional </span>
            </template>
            <el-input
              v-model="integration.imageUrl"
              placeholder="http://<examplehost>/image.jpg"
            />
          </el-form-item>

          <el-form-item prop="secret">
            <template #label>
              Secret <span class="label-helper"> </span>
              <p class="info">
                This unique string is sent with all published events to this
                webhook and can be used to validate the origin of the message.
              </p>
            </template>
            <el-input
              v-if="showSecret"
              v-model="integration.secret"
              placeholder="TODO: Create secret"
            />
            <bf-button v-else class="secondary" @click="generateSecret">
              Generate new secret
            </bf-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 3 (Webhook) -->
      <div class="form-container" v-show="shouldShow(3, 'Webhook')">
        <el-form
          ref="integrationFormStep3a"
          :model="integration"
          label-position="top"
        >
          <el-form-item prop="triggers">
            <template #label>
              Select Triggers <span class="label-helper"> </span>
            </template>

            <el-checkbox
              v-model="integration.eventTypeList.METADATA"
              class="input-property"
              label="Metadata"
            />
            <div class="check-description">
              Dataset name, subtitle, licences, description, image, references,
              tags, contributors, collections, or ignore files list
            </div>

            <el-checkbox
              v-model="integration.eventTypeList.STATUS"
              class="input-property"
              label="Status"
            />
            <div class="check-description">All changes to dataset status</div>

            <el-checkbox
              v-model="integration.eventTypeList.RECORDS_AND_MODELS"
              class="input-property"
              label="Records and Models"
            />
            <div class="check-description">Creating, managing, or removing</div>

            <el-checkbox
              v-model="integration.eventTypeList.FILES"
              class="input-property"
              label="Files"
            />
            <div class="check-description">Creating, managing, or removing</div>

            <el-checkbox
              v-model="integration.eventTypeList.PERMISSIONS"
              class="input-property"
              label="Permissions"
            />
            <div class="check-description">
              Uploading, managing, or deleting
            </div>

            <el-checkbox
              v-model="integration.eventTypeList.PUBLISHING"
              class="input-property"
              label="Publishing"
            />
            <div class="check-description">
              All stages of publishing process
            </div>
            <el-checkbox
              v-model="integration.eventTypeList.CUSTOM"
              class="input-property"
              label="Custom"
            />
            <div class="check-description">
              Custom events from users and integrations
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 3 (Application) -->
      <div class="form-container" v-show="shouldShow(3, 'Application')">
        <div>
          The application will be available as an action for the selected
          targets. Optionally, you can provide a filter to restrict objects that
          can invoke the application. You can select the same target multiple
          times with different filters. Valid targets include: Dataset, File,
          and Files.
          <br /><br />

          <b>Select targets</b> <span class="label-helper">required</span>
        </div>

        <el-form
          ref="integrationFormStep3b"
          :model="integration"
          :rules="rules"
        >
          <el-form-item prop="customTargets">
            <div
              v-for="(item, index) in integration.customTargets"
              class="targetOptions"
            >
              <el-select
                ref="enum"
                v-model="item.target"
                class="input-property target"
                filterable
              >
                <el-option
                  v-for="item in customTargets"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-select
                v-show="showFilter(item.target)"
                ref="enum"
                v-model="item.filter"
                class="input-property filter"
                filterable
              >
                <el-option
                  v-for="item in fileTypes"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-button size="small" @click="removeCustomTarget(index)">
                <Minus style="width: 1em; height: 1em; margin-right: 8px" />
              </el-button>
            </div>
          </el-form-item>
          <el-button size="small" @click="addCustomTarget">
            <Plus style="width: 1em; height: 1em; margin-right: 8px" />
          </el-button>
        </el-form>
      </div>
    </dialog-body>

    <!-- Overview buttons -->
    <template #footer>
      <bf-button class="secondary" @click="advanceStep(-1)">
        {{ stepBackText }}
      </bf-button>
      <bf-button @click="advanceStep(1)">
        {{ createText }}
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../../shared/dialog-body/DialogBody.vue";
import Request from "../../../../mixins/request/index";
import EventBus from "../../../../utils/event-bus";
import { pathOr } from "ramda";

import { mapGetters, mapState } from "vuex";

export default {
  name: "RunAnalysisDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  mixins: [Request],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
  },
  data: function () {
    return {};
  },

  computed: {
    ...mapGetters([]),
    ...mapState(),
  },

  watch: {},

  mounted() {},

  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";
</style>
