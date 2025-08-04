<script lang="ts" setup>
import { useStore } from 'vuex';

import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import * as site from '../../../../site-config/site.json';
import {useRoute} from "vue-router";
import {useSendXhr, useHandleXhrError} from '../../../../mixins/request/request_composable.js'
import IconTrash from "@/components/icons/IconTrash.vue";
import {useGetToken} from '../../../../composables/useGetToken'


const store = useStore()
const route = useRoute()

interface Props {
  dialogVisible: {type: Boolean, required:true},
  modelId: {type: String, required: true};
  property:{type: Object, required: true}
}

const props = defineProps({
  dialogVisible: {type: Boolean, required:true},
  modelId: { type: String, required: true },
  property: {type: Object, required: true}
})

const emit = defineEmits(['close','deleteProperty'])

function closeDialog(isSaved:boolean) {
  emit('close')
}

function onDeleteProperty() {

  const orgIntId = store.state.activeOrganization.organization.intId
  const datasetIntId = store.state.dataset.content.intId
  const propName = props.property.name
  const deletePropUrl = `${site.conceptsUrl}/v2/organizations/${orgIntId}/datasets/${datasetIntId}/models/${props.modelId}/properties/${propName}`

  return useGetToken()
    .then(token => {
      return useSendXhr(deletePropUrl, {
        header: {
          'Authorization': `bearer ${token}`
        },
        method: 'DELETE',
        body:[]
      })
        .then(response => {
          emit('deleteProperty')

        })
    })
    .catch(useHandleXhrError)

}

</script>

<template>
  <div>
    <el-dialog

      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="false"
      @close="closeDialog"
    >

      <template #header>
        <bf-dialog-header
          title="Delete property"
        />
      </template>

      <div class="dialog-main">
        <IconTrash
          class="trash-icon"
          :height="32"
          :width="32"
        />

        <h3>Delete {{ property.displayName }}?</h3>
        <p>Are you sure you want to delete the property from the model?</p>

      </div>


      <template #footer>
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          processing-text="Deleting"
          @click="onDeleteProperty"

        >
          Delete

        </bf-button>
      </template>

    </el-dialog>
  </div>

</template>

<style lang="scss" scoped>
@use '../../../../styles/theme';
@use '../../../../styles/element/dialog';

h1 {
  font-size: 14px;
  margin: 8px 0;
  line-height: 16px;
}

.dialog-main {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;

}

.trash-icon {
  color: theme.$color-error
}

</style>