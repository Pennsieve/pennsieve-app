<script setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import moment from "moment";

import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { PublicationStatus, PublicationType } from "@/utils/constants";
import EventBus from "@/utils/event-bus";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr, useHandleXhrError } from "@/mixins/request/request_composable";

const { datasetId, publicationType = PublicationType.PUBLICATION } = defineProps({
  datasetId: { type: String, required: true },
  publicationType: {
    type: String,
    default: PublicationType.PUBLICATION,
    validator: (value) =>
      [PublicationType.PUBLICATION, PublicationType.EMBARGO].includes(value),
  },
});
const emit = defineEmits(["submitted"]);
const isDialogVisible = defineModel("visible", { type: Boolean, default: false });

const store = useStore();

const isAgreementChecked = ref(false);
const embargoReleaseDate = ref("");
const isSubmitting = ref(false);

const isEmbargo = computed(() => publicationType === PublicationType.EMBARGO);

const dialogTitle = computed(() =>
  isEmbargo.value
    ? "Submit Dataset with Embargo"
    : "Submit Dataset for Standard Review"
);

/**
 * Embargo dates must be in the future, and no more than a year out
 * @param {Date|String} date
 * @returns {Boolean}
 */
function isEmbargoDateAllowed(date) {
  const candidateDate = moment(date);
  return (
    candidateDate.isAfter(moment(), "day") &&
    candidateDate.isSameOrBefore(moment().add(1, "years"), "day")
  );
}

const isEmbargoDateValid = computed(
  () => Boolean(embargoReleaseDate.value) && isEmbargoDateAllowed(embargoReleaseDate.value)
);

const canSubmit = computed(() => {
  if (!isAgreementChecked.value || !datasetId) {
    return false;
  }
  return isEmbargo.value ? isEmbargoDateValid.value : true;
});

function resetDialog() {
  isAgreementChecked.value = false;
  embargoReleaseDate.value = "";
}

// Reset on open too, so a dialog dismissed mid-animation never reopens with stale input
watch(isDialogVisible, (isVisible) => {
  if (isVisible) {
    resetDialog();
  }
});

function closeDialog() {
  isDialogVisible.value = false;
}

async function submitDataset() {
  if (!canSubmit.value) {
    return;
  }

  isSubmitting.value = true;
  try {
    const accessToken = await useGetToken();
    const releaseDateParam = isEmbargo.value ? embargoReleaseDate.value : "";
    const url = `${store.state.config.apiUrl}/datasets/${datasetId}/publication/request?api_key=${accessToken}&publicationType=${publicationType}&embargoReleaseDate=${releaseDateParam}`;

    await useSendXhr(url, { method: "POST" });

    const currentDataset = store.state.dataset;
    store.dispatch("updateDataset", {
      ...currentDataset,
      publication: {
        ...currentDataset.publication,
        status: PublicationStatus.REQUESTED,
        type: publicationType,
      },
    });

    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your dataset has been successfully submitted for review.",
      },
    });

    emit("submitted");
    closeDialog();
  } catch (error) {
    useHandleXhrError(error);
  } finally {
    isSubmitting.value = false;
  }
}

defineExpose({ isEmbargoDateAllowed });
</script>

<template>
  <el-dialog
    v-model="isDialogVisible"
    :show-close="false"
    @closed="resetDialog"
  >
    <template #header>
      <bf-dialog-header :title="dialogTitle" />
    </template>

    <dialog-body>
      <p v-if="isEmbargo">
        Your dataset will be submitted for review and kept under embargo upon
        approval.
      </p>
      <p v-else>
        Your dataset will be submitted for review to the Publishers within
        your organization. While under review, the dataset will become locked
        until it has either been approved or rejected.
      </p>

      <el-checkbox v-model="isAgreementChecked" class="agreement-checkbox">
        I understand that submitting for review will lock this dataset.
      </el-checkbox>

      <div v-if="isEmbargo" class="embargo-date mt-16">
        <label for="embargoReleaseDate" class="embargo-date-label mb-8">
          Embargo Until Date
        </label>
        <el-date-picker
          id="embargoReleaseDate"
          v-model="embargoReleaseDate"
          type="date"
          name="embargoReleaseDate"
          format="MM/DD/YYYY"
          value-format="YYYY-MM-DD"
          placeholder="Select a date"
          :disabled-date="(date) => !isEmbargoDateAllowed(date)"
        />
      </div>
    </dialog-body>

    <template #footer>
      <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
      <bf-button
        processing-text="Submitting"
        :disabled="!canSubmit"
        :processing="isSubmitting"
        @click="submitDataset"
      >
        Confirm Submission
      </bf-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/element/dialog";

.embargo-date {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.embargo-date-label {
  color: theme.$gray_6;
  font-size: 14px;
}

.el-date-editor {
  width: 100%;
}
</style>
