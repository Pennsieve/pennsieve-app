<script setup>
import { useGetToken } from "~/composables/useGetToken.js";
import BfButton from "~/components/Shared/BfButton/BfButton.vue";
import BfDialogHeader from "~/components/Shared/BfDialogHeader/BfDialogHeader.vue";

const runtimeConfig = useRuntimeConfig();
const emit = defineEmits(["deleted-success", "close-dialog"]);

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
});

function closeDialog() {
  emit("close-dialog");
}

async function sendRequest() {
  useGetToken()
    .then((token) => {
      return useSendXhr(
        `${runtimeConfig.public.api2_host}/accounts/github/user`,
        {
          method: "DELETE",
          header: {
            Authorization: `Bearer ${token}`,
          },
        }
      ).then((response) => {
        ElMessage.success("Your Github account has been successfully removed");

        emit("deleted-success");
      });
    })
    .catch((err) => {
      ElMessage.error(
        "Sorry! There was a problem removing your Github account."
      );
    });
}
</script>

<template>
  <el-dialog
    class="dark-header"
    :modelValue="visible"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        title="Delete GitHub Integration?"
        @close="closeDialog"
      />
    </template>

    <template #default>
      <p style="max-width: 450px">
        Are you sure you want to remove your linked GitHub account from your
        Pennsieve user profile?
      </p>
      <li>
        Pennsieve will no longer track GitHub repositories in your account.
      </li>
      <li>
        GitHub releases will no longer result in Pennsieve GitHub Publications.
      </li>
      <li>You can no longer create Applications and Workflows on Pennsieve.</li>
    </template>

    <template #footer>
      <bf-button class="secondary" @click="closeDialog"> Cancel </bf-button>
      <bf-button class="red" @click="sendRequest"> Confirm </bf-button>
    </template>
  </el-dialog>
</template>
