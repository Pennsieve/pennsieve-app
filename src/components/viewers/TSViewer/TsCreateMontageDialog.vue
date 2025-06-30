<script setup>

import BfButton from "@/components/shared/bf-button/BfButton.vue";
import {useStore} from "vuex";
import {ref, computed} from "vue";
import { VueDraggableNext } from 'vue-draggable-next'
import IconXCircle from "@/components/icons/IconXCircle.vue";
import IconTrash from "@/components/icons/IconTrash.vue";
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";
import {useSendXhr} from "@/mixins/request/request_composable";
import { useViewerStore } from '@/stores/tsviewer'

// Stores
const store = useStore(); // Keep for config and activeOrganization
const viewerStore = useViewerStore(); // Use for viewer-related data

const emit = defineEmits('close')

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  }
})

const montageFormRef = ref()
const montageList = ref()

// Computed property to get channels from viewerStore
const viewerChannels = computed(() => viewerStore.viewerChannels)

// DRAG AND DROP
function handleDragStart(event, itemData) {
  event.dataTransfer.setData("application/json", JSON.stringify(itemData));
}

function handleDrop(event, targetContainer) {
  const itemData = JSON.parse(event.dataTransfer.getData('application/json'))
  targetContainer.value = itemData

  draftChannelPairName.value = containerOne.value.value?.label + "-" + containerTwo.value.value?.label

}

let containerOne = ref({})
let containerTwo = ref({})
let draftChannelPairName = ref("")

// FORM DATA
const submitMontageForm = ref({
  name: "",
  displayName: "",
  channelPairs: []
});

const montageRules = ref({
  name: [
    {
      required: true,
      message: "Please add a name for the montage",
      trigger: "submit",
    },
  ],
  channelPairs: [
    {
      required: true,
      message: "Please add channels to the montage",
      trigger: "submit",
    },
  ],
});

function addMontagePair() {
  submitMontageForm.value.channelPairs.push({
    name: draftChannelPairName.value,
    channels: [containerOne.value, containerTwo.value]
  })
  containerOne.value = {}
  containerTwo.value = {}
}

function selectChannelPair(evt) {
  selectedPair.value = evt
  console.log(evt)
}

function removeMontagePair(index) {
  submitMontageForm.value.channelPairs.splice(index,1)
}

function clearMontageInput() {
  containerOne.value = {}
  containerTwo.value = {}
}

const slugify = str =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Submit the drafted montage to the Pennsieve servers.
function submitMontage() {

  montageFormRef.value.validate((valid) => {
    if (!valid) {
      console.log('Form not valid')
      return;
    }

    let channels = []
    const pairs = submitMontageForm.value.channelPairs
    for (let p in pairs) {
      const pair = {
        name: pairs[p].name,
        channels: [pairs[p].channels[0].value.label, pairs[p].channels[1].value.label]
      };
      channels.push(pair)
    }

    const endpoint = `${store.state.config.api2Url}/timeseries/montages`;
    const queryParams = toQueryParams({
      organization_id: store.state.activeOrganization.organization.id,
    })

    const url = `${endpoint}?${queryParams}`

    return useGetToken().then((token) => {
      useSendXhr(url, {
        method: "POST",
        header: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          name: slugify(submitMontageForm.value.name),
          displayName: submitMontageForm.value.name,
          channelPairs: channels,
        },
      }).then(() => {
        console.log('SUCCESS')
        // Use viewerStore instead of Vuex for fetching workspace montages
        viewerStore.fetchWorkspaceMontages()
        emit('close')
      });
    });

  });

}

const selectedPair = ref({})

function cancel() {
  emit('close')
}

</script>

<template>
  <div class="create-montage-dialog" v-if="visible">
    <div class="container">
      <div class="header">
        <h1>Create Montage</h1>
      </div>

      <div class="content">
        <el-form
          ref="montageFormRef"
          label-position="top"
          :model="submitMontageForm"
          :rules="montageRules"
          status-icon
          :inline-message="false"
          :show-message="true"
          @submit.native.prevent="submitMontage()"

        >
          <el-form-item
            label="Montage Name"
            prop="name"
            :show-message="false"
          >
            <div class="name-container">
              <p class="name-info">
                Choose a unique name for the montage. All montages are shared within a workspace.
              </p>
              <el-input
                v-model="submitMontageForm.name"
                class="montage-name"
                placeholder="Provide a unique name for the montage."
              />
            </div>

          </el-form-item>

          <div class="channel-selector-container">
            <div v-for="ch in viewerChannels" :key="ch.id">
              <div class="channel" draggable="true" v-on:dragstart="handleDragStart($event, ch)">
                {{ch.label}}
              </div>

            </div>
          </div>

          <el-form-item label="Create montaged channel">
            <div>
              <p class="name-info">
                Drag and drop channels from above into the channel-pair slots and add the pair to the montage.
              </p>
              <div class="montage-container">

                <div class="drop-container">

                  <div class="drop-box" v-on:dragover.prevent v-on:drop="handleDrop($event, containerOne)" >
                    <div v-if="!containerOne.value" class="default-input">
                      Drag channel
                    </div>
                    <div v-else class="channel-input">
                      {{containerOne.value?.label}}

                    </div>
                  </div>
                  <div class="drop-box" v-on:dragover.prevent v-on:drop="handleDrop($event, containerTwo)" >
                    <div v-if="!containerTwo.value" class="default-input">
                      Drag channel
                    </div>
                    <div v-else class="channel-input">
                      {{containerTwo.value?.label}}
                    </div>
                  </div>
                  as
                  <el-input
                    v-model="draftChannelPairName"
                    class="montage-name"
                    placeholder="Display as..."
                  />
                  <bf-button @click="addMontagePair"> Add</bf-button>
                  <bf-button @click="clearMontageInput" class="flex">
                    <template #prefix>
                      <IconTrash/>
                    </template>
                  </bf-button >

                </div>
              </div>
            </div>
          </el-form-item>



          <el-form-item
            prop="channelPairs"
            :show-message="true"
          >
            <template #label>
              <span>Montage List </span>
              <span class="form-item-desc">(Drag items to re-order)</span>
            </template>

            <div class="montage-pair-list">
              <vue-draggable-next class="draggable" :list="submitMontageForm.channelPairs" tag="transition-group" item-key="id"  @change="log">
                <div v-for="(pair, index) in submitMontageForm.channelPairs" :key="index">
                  <div class="pair" @click="selectChannelPair(pair)" :class="[ selectedPair?.name === pair.name ? 'selected' : '' ]">
                    <div >{{pair.name}}</div>
                    <button class="action" @click="removeMontagePair(index)"><icon-x-circle stroke="#808fad" fill="#e5e5e5" :height="20" :width="20"/></button>
                  </div>


                </div>
              </vue-draggable-next>
            </div>

          </el-form-item>
        </el-form>

      </div>

      <div class="footer">
        <bf-button @click="submitMontage">Save</bf-button>
        <bf-button @click="cancel">Cancel</bf-button>
      </div>

    </div>

  </div>
</template>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.form-item-desc {
  color: $gray_4;
  font-weight: 300;

}

.montage-name{
  --el-input-focus-border-color: #808fad;
}

.create-montage-dialog {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(153, 153, 153, 0.8);;
  z-index: 100;


  .container {
    margin: 24px;
    flex: 1;
    background: $gray_1;
    width: calc(100% - 48px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 0 4px 4px rgba(0, 0, 0, 0.1);
    border-radius: 4px;


    .header {
      background: $purple_2;
      padding: 8px 16px;
      border-radius: 4px 4px 0 0 ;

      h1 {
        margin: 0;
        color: white;
      }

    }

    .footer {
      border-top: 1px solid $gray_2;
      padding: 16px;
      display: flex;
      gap: 16px;
    }
  }

  .content {
    display: block;
    //flex-direction: column;
    //height: 100%;
    padding: 24px;

    overflow: auto;

    .channel-selector-container {
      display: flex;
      gap: 4px;
      margin: 24px 0 ;
      flex-wrap: wrap;

      .channel {
        border: 1px solid $purple_1;
        padding: 4px 8px;
        background: $purple_tint;
      }
    }
    .montage-container {
      justify-content: center;

      .drop-container {
        display: flex;
        flex-direction: row;
        gap: 8px;

        .drop-box {
          background: white;
          border: 1px dashed $purple_3;
          min-width: 150px;
          color: $purple_3;
          padding: 0 8px;

          .default-input{
            text-align: left;
            padding: 3px;
            color: $gray_3;
            font-weight: 300;

          }

          .channel-input{
            text-align: left;
            padding: 3px;
            color: $purple_3;
            font-weight: 300;
            --el-input-focus-border-color: red;
          }
        }
      }
    }
    .montage-pair-list {
      display: flex;
      flex-direction: column;

      .draggable {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        min-height: 200px;
        max-height: 400px;
        gap: 4px;


        .pair {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          vertical-align: center;
          color: $purple_3;
          padding: 4px 8px;
          border: 1px solid $purple_tint;
          background: white;

          &.selected {
            background: $purple_tint;
            border: 1px solid $purple_2;
          }

          .action {
            display: flex;
            align-items: center;
            margin: 0;
            padding-left:8px;
            padding-right:0px;
          }
        }
      }



    }
  }



}

</style>