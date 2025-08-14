<script lang="ts" setup>
import { useStore } from 'vuex';

import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import * as site from '../../../../site-config/site.json';
import {useSendXhr, useHandleXhrError} from '../../../../mixins/request/request_composable.js'
import IconTrash from "../../../../components/icons/IconTrash.vue";
import {useGetToken} from "../../../../composables/useGetToken"

const store = useStore()

interface Props {
  dialogVisible: {type: Boolean, required:true},
  modelId: {type: String | null, required: true};
  link:{type: Object, required: true}
}

const props = defineProps({
  dialogVisible: {type: Boolean, required:true},
  modelId: { type: String, required: true },
  link: {type: Object, required: true}
})

const emit = defineEmits(['close','deleteRelationship'])

function closeDialog(isSaved:boolean) {
  emit('close')
}

function onDeleteRelationship() {


  return useGetToken()
    .then(token => {
      const datasetId = store.state.dataset.content.id
      const deletePropUrl = `${site.conceptsUrl}/datasets/${datasetId}/relationships/${props.link.property.id}`
      return useSendXhr(deletePropUrl, {
        header: {
          'Authorization': `bearer ${token}`
        },
        method: 'DELETE',
        body:[],
      })
        .then(response => {
          emit('deleteRelationship')

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

        <h3>Delete {{ link.property.displayName }}?</h3>
        <p>Are you sure you want to delete the relationship from the model?</p>

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
          @click="onDeleteRelationship"

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
  color: theme.$error-color
}

</style>