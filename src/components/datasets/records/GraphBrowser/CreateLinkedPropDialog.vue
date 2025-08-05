<script lang="ts" setup>
import {ref, reactive, computed, onMounted, watch} from "vue";
import { useStore } from 'vuex';

import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import * as site from '../../../../site-config/site.json';
import snakeCase from 'lodash.snakecase'
import {useRoute} from "vue-router";
import {useSendXhr, useHandleXhrError} from '@/mixins/request/request_composable'
import {useGetToken} from '@/composables/useGetToken'

const store = useStore()
const route = useRoute()

interface RelationshipRequestBody {
  description: string;
  displayName: string;
  from: string;
  name: string;
  schema: Array<Object> ;
  to: string;
}

interface LinkedPropRequestBody {
  name: string;
  displayName: string;
  to: string;
  position: number
}

interface Props {
  dialogVisible: boolean;
  input:{type: Connection | undefined, required: true}
}

const props = defineProps({
  dialogVisible: { type: Boolean, required: false },
  input: {type: null, required: true}
})

const relationship = ref({relationshipName: null, type: 'single'})


const emit = defineEmits(['close'])



function closeDialog(isSaved:boolean) {
  const type = createForm.multiple ?  "schemaRelationship" : "schemaLinkedProperty"

  emit('close', {addedRelationship: isSaved, connection: props.input, displayName: createForm.label, type: type})

}

import type { ComponentSize, FormInstance, FormRules } from 'element-plus'

import IconRotateRight from "../../../icons/IconRotateRight.vue";
import {pathOr} from "ramda";


interface CreateForm {
  label: string,
  multiple: boolean,
}
const createFormRef = ref<FormInstance>()
const createForm = reactive<CreateForm>({
  label:"",
  multiple: false,
})

const rules = reactive<FormRules<CreateForm>>({
  label: [
    { required: true,
      trigger: 'change',
      message: 'Please select a relationship name',
    },
  ],
  multiple: [
    {
      type: 'boolean',
      required: false,
      trigger: 'change',
    },
  ]
})

watch(() => props.dialogVisible, (value, valueOld) => {
  if (value) {
    createForm.label = effectiveTarget.value.data.label
  }

})


const submitForm = async (formEl: FormInstance | undefined) => {

  if (!formEl) return
  await formEl.validate((valid, fields) => {

    if (valid) {
      if (createForm.multiple) {
        postCreateRelationship()
      } else {
        postLinkedPropertyChanges()
      }

    } else {
      console.log('error submit!', fields)
    }
    return valid
  })
  return false
}


const propNameOrUnknown = computed( () => {
  if (createForm.label.length != 0) {
    return createForm.label
  }

  return "unknown"
})

const singleOrMultipleStr = computed( () => {
  if (createForm.multiple) {
    return "multiple records"
  }

  return "a single record"
})


// Reverse targets
let reverseTargets = ref(false)

function toggleReverse() {
  reverseTargets.value = !reverseTargets.value
  createForm.label = effectiveTarget.value.data.label
}

import { Connection} from '@vue-flow/core'

const effectiveSource = computed( () => {
  if (reverseTargets.value) {
    return props.input.target
  }

  return props.input.source
})

const effectiveTarget = computed( () => {
  if (reverseTargets.value) {
    return props.input.source
  }

  return props.input.target
})

function postCreateRelationship() {

  useGetToken()
    .then(token => {
      const datasetId = pathOr('', ['params', 'datasetId'])(route)
      const createRelationshipUrl = `${site.conceptsUrl}/datasets/${datasetId}/relationships`
      const payload = <RelationshipRequestBody>{
        description: "",
        displayName: createForm.label,
        from: effectiveSource.value.data.id,
        name: snakeCase(createForm.label),
        schema: [],
        to: effectiveTarget.value.data.id
      }

      return useSendXhr(createRelationshipUrl, {
        header: {
          'Authorization': `bearer ${token}`
        },
        method: 'POST',
        body: payload
      })
        .then(() => {
          closeDialog(true)

        })

    })
    .catch(useHandleXhrError)

}


function postLinkedPropertyChanges() {
  useGetToken()
    .then(async token => {
      const datasetId = pathOr('', ['params', 'datasetId'])(route)
      const linkedPropertiesUrl = `${site.conceptsUrl}/datasets/${datasetId}/concepts/${effectiveSource.value.data.id}/linked`
      const url = `${linkedPropertiesUrl}/bulk`
      const payload = <LinkedPropRequestBody>{
        name: snakeCase(createForm.label),
        displayName: createForm.label,
        to: effectiveTarget.value.data.id,
        position: 1
      }
      const body = [payload]
      return useSendXhr(url, {
        header: {
          'Authorization': `bearer ${token}`
        },
        method: 'POST',
        body: body
      })
        .then(response => {
          closeDialog(true)
        })
    })
    .catch(useHandleXhrError)
}


</script>

<template>
  <div>
    <el-dialog
      class="create-linked-prop-dialog"
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="false"
      @close="closeDialog"
    >

      <template #header>
        <bf-dialog-header
          slot="title"
          title="Create a link between models"
        />
      </template>


      <div class="relationship-info">
        <div class="title">{{effectiveSource.data.label}} --> {{effectiveTarget.data.label}}</div>
        <bf-button class="icon secondary" @click="toggleReverse">
          <template #default>
            <IconRotateRight/>

          </template>
        </bf-button>
      </div>

      <div class="modal-info">Properties that point to other records are called <u>links</u>. Links are defined in the model schema. You can use links to relate records of different types. Pennsieve can use links for advanced querying and visualization.  </div>


      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="rules"
        label-position="top"
      >

        <el-form-item prop="label">
          <template #label>
            Property Name <span class="label-helper">
              required
            </span>
          </template>
          <el-input
            v-model="createForm.label"
            placeholder="Provide a property name"
            autofocus
          />

        </el-form-item>

        <el-form-item label="Options">
          <el-checkbox v-model="createForm.multiple" prop="multple"  label="Allow multiple links" size="large" />
        </el-form-item>

        <div class="info-panel">
          <ul> <li> Records of type <u>{{effectiveSource.data.label}}</u> will have a property (<b>{{propNameOrUnknown}} </b>) that links to <b>{{ singleOrMultipleStr }}</b> of type <u> {{effectiveTarget.data.label}}</u>.</li>
            <li> Records of type <u>{{effectiveTarget.data.label}}</u> will have links to <b>multiple records </b>of type <u> {{effectiveSource.data.label}}</u>.</li>
          </ul>
        </div>

      </el-form>

      <template #footer>
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          processing-text="Saving"
          @click="submitForm(createFormRef)"

        >
          Create

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

  .modal-info {
    margin-bottom: 32px;

  }

 .relationship-info {
   display: flex;
   flex-direction: row;
   justify-content: space-between;
   text-align: center;
   margin-bottom: 8px;

   .title {
     font-size: 14pt;
     align-content: center;
   }
 }

.info-panel {
  background: theme.$purple_tint;
  padding: 8px 100px 8px 8px ;
}

li {
  margin: 16px 0;

  b {
    color: theme.$purple_3;
  }
}

</style>