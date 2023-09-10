<template>
  <el-dialog
    class="light-header fixed-width simple"
    :show-close="false"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    @close="closeDialog"
  >

    <dialog-body>
      <IconPerson
        class="person-icon"
        :height="32"
        :width="32"
      />
      <h2 slot="heading">
        Delete {{ member.firstName }} {{ member.lastName }}?
      </h2>
      <p>This user will lose access to any datasets shared with this team.</p>
      <h2 class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          @click="removeCollaborator"
        >
          Delete
        </bf-button>
      </h2>
    </dialog-body>
  </el-dialog>
</template>



<script>
import { mapGetters } from 'vuex'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import Request from '../../../mixins/request'
import EventBus from '../../../utils/event-bus'
import IconPerson from "../../icons/IconPerson.vue";

export default {
  name: 'RemoveCollaborator',

  components: {
    IconPerson,
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    Request
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
    team: {
      type: Object
    },
    member: {
      type: Object,
      default: {
        firstName: "?",
        lastname: "?"
      }
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'userToken',
      'config'
    ]),
  },

  data() {
    return {
      // member: {}
    }
  },

  methods: {
    /**
     * Closes remove member dialog
     */
    closeDialog: function() {
      this.$emit("close-dialog")
    },
    /**
     * Handles open-remove-collaborator event
     * @param {Object} member
     */
    handleOpenRemoveCollaborator: function(member) {
      this.member = member
    },
    /**
     * Creates DELETE url to remove member from org
     */
    deleteUrl: function() {
      const orgId = this.activeOrganization.organization.id
      const userToken = this.userToken
      const apiUrl = this.config.apiUrl
      return `${apiUrl}/organizations/${orgId}/teams/${this.team.team.id}/members/${this.member.id}?api_key=${userToken}`
    },
    /**
     * Makes XHR call to remove collaborator from team
     */
    removeCollaborator: function() {
      this.sendXhr(this.deleteUrl(), {
        method: 'DELETE'
      })
      .then(() => {
        this.$emit('team-member-removed', this.member)
        EventBus.$emit('toast', {
          detail: {
            type: 'info',
            msg: `${this.member.firstName} ${this.member.lastName} removed from ${this.team.team.name}`
          }
        })
        this.closeDialog()
      })
      .catch(this.handleXhrError.bind(this))
    }
  }
}
</script>

<style lang="scss">
@import '../../../assets/variables.scss';

.person-icon {
  color: $purple_1;
}
</style>