<template>
  <div>
    <el-dialog
      class="timeseries-filter-modal"
      ref="filter-modal"
      title="Dataset Description"
      :modelValue="visible"
      @update:modelValue="visible = $event" @close='close'
    >

      <template #default>
        <div slot="body">
          <div>
            <button
              v-if="isEditingMarkdownDescription"
              class="linked mr-8"
              @click="isEditingMarkdownDescription= false"
            >
              Cancel
            </button>
            <button
              v-if="isEditingMarkdownDescription"
              class="linked"
              @click="isSavingMarkdownDescription = true"
            >
              Save
            </button>

            <button
              v-else
              slot="title-aux"
              class="linked-9"
              @click="isEditingMarkdownDescription= true"
            >
              Update
            </button>
          </div>
          <markdown-editor
            ref="markdownEditor"
            :value="datasetDescription"
            :is-editing="isEditingMarkdownDescription"
            :is-saving="isSavingMarkdownDescription"
            :empty-state="datasetDescriptionEmptyState"
            :is-loading="isLoadingDatasetDescription"
            @save="onReadmeSave"
          />

        </div>

      </template>

      <template #footer>
        <div slot="footer">
          <div class="button-wrapper">
            <div class="buttons">
              <bf-button @click="isSavingMarkdownDescription = true">Save and Close
              </bf-button>
            </div>
          </div>

        </div>
      </template>


    </el-dialog>

  </div>

</template>

<script>
import {
  mapActions,
  mapState
} from 'vuex'

import IconSelection from "../../icons/IconSelection.vue"
import MarkdownEditor from "@/components/shared/MarkdownEditor/MarkdownEditor.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import datasetDescriptionEmptyState from '@/components/datasets/DatasetOverview/dataset-description-empty-state'
import {propOr} from "ramda";

export default {
  name: 'ReadmeModal',

  components: {
    MarkdownEditor,
    'bf-button': () => import('@/components/shared/bf-button/BfButton.vue'),
    IconSelection
  },

  mixins: [
  ],

  computed: {
    ...mapState([
      'config',
      'datasetDescription',
      'datasetDescriptionEtag',
      'isLoadingDatasetDescription',
    ]),

  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    activeViewer: {
      type: Object,
      required: true
    }
  },

  watch: {
    activeViewer: {
      handler: function() {
        if (!this.datasetDescription) {
          console.log('GETTING DESCRITPION')
          this.getDatasetDescription()
        }
      },
      deep: true
    }
  },
  data: function () {
    return {
      isEditingMarkdownDescription: false,
      isSavingMarkdownDescription: false,
      datasetDescriptionEmptyState
    }

  },

  methods: {
    ...mapActions(['setDatasetDescription', 'setDatasetDescriptionEtag','setIsLoadingDatasetDescription']),

    close: function () {
      this.$emit('closeWindow')
    },

    getDatasetDescription: function () {
      this.setIsLoadingDatasetDescription(true);
      useGetToken()
        .then((token) => {
          const url = `${this.config.apiUrl}/datasets/${this.activeViewer.content.datasetId}/readme?api_key=${token}`;
          fetch(url).then((response) => {
            if (response.ok) {
              response.json().then((data) => {
                const readme = propOr("", "readme", data);
                this.setDatasetDescriptionEtag(response.headers.get("etag"));
                this.setDatasetDescription(readme);
              });
            } else {
              throw response;
            }
          });
        })
        // .catch(this.handleXhrError.bind(this))
        .finally(() => {
          this.setIsLoadingDatasetDescription(false);
        });
    },


    onReadmeSave: function(markdown) {
      console.log('saving readme')
      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/datasets/${this.activeViewer.content.datasetId}/readme?api_key=${token}`
          return useSendXhr(url, {
            body: {
              readme: markdown
            },
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'If-Match': this.datasetDescriptionEtag,
            }
          })
            .then(response => {
              if (response.ok) {
                this.setDatasetDescriptionEtag(response.headers.get('etag'))
                this.setDatasetDescription(markdown).finally(() => {
                  this.isSavingMarkdownDescription = false
                  this.isEditingMarkdownDescription
                    = false
                })
              } else if (response.status === 412) {
                this.isSavingMarkdownDescription = false
                this.staleUpdateDialogVisible = true
              } else {
                throw response
              }
            })
            .then( () =>{
              this.close()
            })
        })
        .catch(useHandleXhrError)

    },
  }
}

</script>

<style lang="scss" scoped>
@use '../../../styles/theme';
@use '../../../styles/element/dialog';

.timeseries-filter-modal {
  display: block;
  box-sizing: border-box;
}

.filterInput {
  width: 100%
}

.select-wrapper {
  display: flex;
  flex-direction: column;
  border-left: 5px solid var(--dopamine)
}

#layerSelect {
  margin: 0 0 10px;
  width: auto;
}

.channels-icon {
  border: 1px solid var(--light-gray);
  border-radius: 2px;
  color: var(--light-gray);
  margin-right: 5px;
}

.button-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.channels-selected {
  display: flex;
  flex-direction: row;
  margin-right: 20px;
  line-height: 24px;

  svg {
    margin-right: 8px;
  }
}

h2 {
  margin: 20px 30px 30px 30px;
}

.filter-input-wrapper {
  margin-top: 24px;
}
</style>