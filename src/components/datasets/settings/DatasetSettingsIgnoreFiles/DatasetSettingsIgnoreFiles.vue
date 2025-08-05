<template>
  <div class="dataset-settings-ignore-files">
    <h3>Ignore Files</h3>
    <p class="mb-16">
      The files listed below will be ignored during publication. Please use the entire source file name and extension. List one filename per line.
      <a
        href="https://docs.pennsieve.io/docs/preventing-files-from-being-included-during-publishing"
        target="_blank"
      >
        What's this?
      </a>
    </p>
    <el-input
      v-model="ignoreFiles"
      type="textarea"
      :autosize="{ minRows: 5 }"
      placeholder="Input filenames to ignore e.g. file.txt"
      :disabled="datasetLocked"
      @input="submitIgnoreFilesRequest"
    />
  </div>
</template>

<script>
  import debounce from 'lodash/debounce'
  import { mapGetters, mapState, mapActions } from 'vuex'
  import {useGetToken} from "@/composables/useGetToken";
  import {useHandleXhrError} from "@/mixins/request/request_composable";

  export default {
    name: 'DatasetSettingsIgnoreFiles',

    data() {
      return {
        ignoreFiles: ''
      }
    },

    computed: {
      ...mapState([
        'config',
        'dataset',
        'datasetIgnoreFiles'
      ]),

      ...mapGetters(['datasetLocked']),

      /**
       * Create properly formatted ignore files DTO, is empty if
       * there are no ignore files
       * @returns {Array}
       */
      ignoreFilesDTO: function() {
        // Account for newlines with no filename
        return this.ignoreFiles ? this.toIgnoreFilesDTO((this.ignoreFiles.split('\n').filter(fileName => fileName.length))) : []
      },
    },

    watch: {
      datasetIgnoreFiles: {
        handler(newVal) {
          this.ignoreFiles = newVal.map(file => file.fileName).join('\n');
        },
        immediate: true,
      }
    },

    methods: {
      ...mapActions(['setDatasetIgnoreFiles']),

      /**
       * Submit a request with the updated ignore files,
       * debounced to 1 second
       */
      submitIgnoreFilesRequest: debounce(function() {
        useGetToken()
          .then(token => {
            const datasetId = this.dataset.content.id || ''
            const url = `${this.config.apiUrl}/datasets/${datasetId}/ignore-files`

            fetch(url, {
              method: 'PUT',
              body: JSON.stringify(this.ignoreFilesDTO),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `bearer ${token}`
              }
            })
              .then(response => {
                if (response.ok) {
                  response.json().then(resp => {
                    const ignoreFiles = (resp.ignoreFiles || []).map(file => file.fileName)
                    this.setDatasetIgnoreFiles(this.toIgnoreFilesDTO(ignoreFiles))
                  })
                }
          })

        })
          .catch(useHandleXhrError)
      }, 1000),

      /**
       * Convert array of ignore filenames to proper DTO in the shape
       * [{fileName: "file1.txt"}, {fileName: "file2.txt"}]
       * @param {Array}
       * @returns {Array}
       */
      toIgnoreFilesDTO: function(ignoreFiles) {
        return ignoreFiles.map(fileName => ({ fileName }))
      }
    }
  }
</script>

<style lang="scss" scoped>
@use '../../../../styles/element/input';

p {
  color: #000;
}
</style>
