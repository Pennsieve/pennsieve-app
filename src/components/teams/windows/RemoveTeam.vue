<template>
  <el-dialog
    :show-close="true"
    v-model="dialogVisible"
    @close="closeDialog"
    class="light-header fixed-width simple"
  >
    <dialog-body>
      <template #icon>
        <IconTeam
          class="team-icon"
          slot="icon"
          :height="32"
          :width="32"
        />
      </template>

      <template #heading>
        <h2 slot="heading">
          Delete {{ teamName }}?
        </h2>
      </template>

      <template #default>
        <p>Collaborators will lose access to any datasets shared with this team.</p>
        <div class="dialog-simple-buttons">
          <bf-button
            class="secondary"
            @click="closeDialog"
          >
            Cancel
          </bf-button>
          <bf-button
            class="red"
            @click="removeTeam"
          >
            Delete
          </bf-button>
        </div>
      </template>
    </dialog-body>
  </el-dialog>
</template>

<style lang="scss">
@import '../../../assets/variables.scss';

.team-icon {
  color: $purple_1;
}

.dialog-simple-buttons {
  display: flex;
  margin-top: 16px;
  justify-content: center;
  .bf-button{
    margin-left: 8px;
  }
}
</style>

<script>
import {mapGetters} from 'vuex'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import Request from '../../../mixins/request'
import EventBus from '../../../utils/event-bus'
import {pathOr, propOr} from 'ramda'
import IconTeam from "../../icons/IconTeam.vue";

export default {
  name: 'RemoveTeam',

  components: {
    IconTeam,
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    Request
  ],

  computed: {
    ...mapGetters([
      'activeOrganization',
      'userToken',
      'config'
    ]),
    teamName: function() {
      const defaultName = propOr('Team', 'name', this.team)
      return pathOr(defaultName, ['team', 'name'], this.team)
    }
  },

  data() {
    return {
      dialogVisible: false,
      team: {}
    }
  },

  mounted() {
    EventBus.$on('open-remove-team', this.handleRemoveTeam.bind(this))
  },

  beforeDestroy() {
    EventBus.$off('open-remove-team', this.handleRemoveTeam.bind(this))
  },

  methods: {
    /**
     * Closes remove member dialog
     */
    closeDialog: function() {
      this.dialogVisible = false
    },
    /**
     * Handles remove-team event
     * @param {Object} teamData
     */
    handleRemoveTeam: function(teamData) {
      this.dialogVisible = true
      this.team = teamData.team
    },
    /**
     * Creates DELETE url to remove member from org
     */
    deleteUrl: function() {
      const orgId = this.activeOrganization.organization.id
      const userToken = this.userToken
      const apiUrl = this.config.apiUrl
      return `${apiUrl}/organizations/${orgId}/teams/${this.team.id}?api_key=${userToken}`
    },
    /**
     * Makes XHR call to remove team from org
     */
    removeTeam: function() {
      const url = this.deleteUrl()
      this.sendXhr(url, {
        method: 'DELETE'
      })
      .then(() => {
        const teamName = propOr('Team', 'name', this.team)
        const orgName = pathOr('organization', ['organization', 'name'], this.activeOrganization)
        EventBus.$emit('toast', {
          detail: {
            type: 'MESSAGE',
            msg: `${teamName} removed from ${orgName}`
          }
        })
        if (this.$route.name === 'team-members-list') {
          return this.$router.push('../teams')
        }
        this.closeDialog()
        this.$emit('team-removed', {team: this.team})
      })
      .catch(this.handleXhrError.bind(this))

    }
  }
}
</script>
