<template>
  <div
    v-loading="isLoading"
    class="palette-discussions"
  >
    <div class="action-buttons">
      <bf-button @click="openReadmeModal">
        Open Dataset Description
      </bf-button>
    </div>


    <discussion-add-comment
      ref="addComment"
      :annotation-id.sync="annotationId"
      :start-discussion="true"
    />

    <div
      v-if="hasDiscussions"
      class="discussions-wrap"
    >
      <bf-discussion
        v-for="item in sortedDiscussions"
        :id="item.id"
        :key="item.id"
        :discussion="item"
        :comments="getComments(item.id)"
      />
    </div>

    <viewer-side-panel-empty-state v-if="showEmptyState">
      <template #illustration>
        <img
          src="/src/assets/images/illustrations/illo-sharing.svg"
          alt="illustration of two people interacting"
        >
      </template>

      <p>Add a comment to start a discussion. @mention a team member to send an them an invitation to comment.</p>
    </viewer-side-panel-empty-state>

    <div
      v-if="overlayIsVisible"
      class="mentions-overlay"
      @click="overlayIsVisible = false"
    />

    <ReadmeModal :visible="readmeModalVisible" :active-viewer="activeViewer" @close-window="closeReadmeModal"/>

  </div>
</template>

<script>
  import {
    mapState,
    mapActions
  } from 'vuex'
  import {
    pathOr,
    propOr,
    defaultTo
  } from 'ramda'

  import BfDiscussion from './BfDiscussion/BfDiscussion.vue'
  import DiscussionAddComment from './DiscussionAddComment/DiscussionAddComment.vue'
  import ViewerSidePanelEmptyState from '../../BfViewerSidePanel/ViewerSidePanelEmptyState/ViewerSidePanelEmptyState.vue'

  import Request from '../../../../mixins/request'
  import ImportHref from '../../../../mixins/import-href'
  import Sorter from '../../../../mixins/sorter'
  import {useGetToken} from "@/composables/useGetToken";
  import ReadmeModal from "@/components/shared/ReadmeModal/ReadmeModal.vue";
  import BfButton from "@/components/shared/bf-button/BfButton.vue";

  export default {
    name: 'PaletteDiscussions',

    components: {
      BfButton,
      ReadmeModal,
      BfDiscussion,
      DiscussionAddComment,
      ViewerSidePanelEmptyState
    },

    props: {
      activeViewer: {
        type: Object,
        default: ()=>{},
      }
    },

    mixins: [
      ImportHref,
      Request,
      Sorter
    ],

    data() {
      return {
        readmeModalVisible: false,
        overlayIsVisible: false,
        annotationId: null
      }
    },

    computed: {
      ...mapState('viewerModule', ['viewerSidePanelView', 'viewerDiscussions']),
      ...mapState(['config']),

      /**
       * Compute URL for getting discussions
       * @returns {String}
       */
      getDiscussionsUrl: async function() {

        return await useGetToken()
          .then(token => {
            const packageId = pathOr('', ['content', 'id'], this.activeViewer)
            const apiUrl = propOr('', 'apiUrl', this.config)

            if (packageId && apiUrl && this.viewerSidePanelView === 'discussion') {
              return `${apiUrl}/discussions/package/${packageId}?api_key=${token}`
            }
          })
          .catch(e => console.log(e))

      },

      /**
       * Compute if the package has discussions
       * @returns {Boolean}
       */
      hasDiscussions: function() {
        const discussions = propOr([], 'discussions', this.viewerDiscussions)
        return discussions.length > 0
      },

      /**
       * Sort discussions by updatedAt
       * @returns {Array}
       */
      sortedDiscussions: function() {
        return this.returnSort('updatedAt', this.viewerDiscussions.discussions, 'desc')
      },

      /**
       * Show empty state if there are no discussions and it is not loading
       * @returns {Boolean}
       */
      showEmptyState: function() {
        return this.hasDiscussions === false && this.isLoading === false
      }
    },

    watch: {
      /**
       * Watch discussions URL changes and get discussions
       */
      getDiscussionsUrl: {
        handler: function(val) {
          if (val) {
            this.getDiscussions()
          }
        },
        immediate: true
      }
    },

    methods: {
      ...mapActions('viewerModule', ['setDiscussions', 'removeDiscussion']),

      closeReadmeModal: function() {
        this.readmeModalVisible = false
      },
      openReadmeModal: function() {
        this.readmeModalVisible = true
      },
      /**
       * Get discussions and set state
       */
      getDiscussions: function() {
        this.sendXhr(this.getDiscussionsUrl).then(response => {
          const discussions = defaultTo([], response)
          this.setDiscussions(discussions)
        })
        .catch(this.handleXhrError.bind(this))
      },

      /**
       * Start discussion from annotation
       * @param {String} annotationId
       */
      startDiscussion: function(annotationId) {
        this.annotationId = annotationId
        this.$refs.addComment.focus()
      },

      /**
       * Get comments by discussion ID
       * @param {String}
       * @returns {Array}
       */
      getComments: function(id) {
        return pathOr([], ['comments', id], this.viewerDiscussions)
      }
    }
  }
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as *;


.action-buttons {
  display: flex;
  padding: 4px;
  background: $purple_0_7
}
  .palette-discussions {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }
  .discussions-wrap {
    flex: 1;
    overflow: scroll;
  }
  .mentions-overlay {
    background-color: #4A4A4A;
    display: block;
    height: 100%;
    left: 0;
    opacity: .51;
    overflow: hidden;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 99;
  }
</style>
