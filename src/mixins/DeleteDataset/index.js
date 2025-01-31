import { propOr, pathOr, prop } from 'ramda'
import { mapState, mapActions } from 'vuex';

import EventBus from '../../utils/event-bus'
import {useGetToken} from "@/composables/useGetToken";

export default {
  computed: {
    ...mapState([
      'config',
    ]),

    /**
     * Compute dataset endpoint URL
     * @returns {String}
     */
    datasetUrl: async function() {
      const url = propOr('', 'apiUrl')(this.config)
      const datasetId = pathOr('', ['content', 'id'])(this.dataset)

      return useGetToken()
          .then(token => {
            return `${url}/datasets/${datasetId}?api_key=${token}`;
          })
    },
  },

  methods: {
    ...mapActions([
      'removeDataset'
    ]),

    /**
     * Makes XHR call to delete a dataset
     */
    submitDeleteDatasetRequest: function() {
      this.datasetUrl
          .then(url => {
            this.sendXhr(url, {
              method: 'DELETE'
            })
                .then(this.handleDeleteDatasetSuccess.bind(this))
                .catch(this.handleXhrError.bind(this))
          })

    },

    /**
    * Handles successful dataset delete
    */
    handleDeleteDatasetSuccess: function() {
      this.removeDataset(this.dataset).then(() => {
        EventBus.$emit('toast', {
          detail: {
            msg: 'Dataset deleted'
          }
        })

        this.$router.replace({ name: 'datasets-list' })
      })
    },
  }
}
