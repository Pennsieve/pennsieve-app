<template>
  <el-dialog
    :show-close="false"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    @open="onOpen"
    @close="closeDialog"
  >

    <template #header>
      <bf-dialog-header
        :title="modalTitle"
      />
    </template>

    <dialog-body>
      <el-form
        ref="teamForm"
        :model="ruleForm"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="createEditTeam('teamForm')"
      >
        <el-form-item
          label="Team Name"
          prop="name"
        >
          <el-input
            v-model="ruleForm.name"
            autofocus
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        class="primary"
        @click="createEditTeam('teamForm')"
      >
        <span v-if="!isEditing">
          Create
        </span>
        <span v-if="isEditing">
          Save
        </span>
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { mapGetters } from 'vuex'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import Request from  '../../../mixins/request'
import AutoFocus from '../../../mixins/auto-focus'
import EventBus from '../../../utils/event-bus'
import {  path, pathOr, pathEq } from 'ramda'
import autoFocus from "../../../mixins/auto-focus";

export default {
  name: 'CreateEditTeam',

  components: {
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    Request,
    AutoFocus
  ],

  computed: {
    ...mapGetters([,
      'activeOrganization',
      'userToken',
      'config',
      'teams'
    ]),
    modalTitle: function() {
      return this.isEditing ? 'Update Team': 'Create Team'
    },
  },

  props: {
    // If true, we are updating an existing team
    isEditing: {
      type: Boolean,
      default: false
    },
    dialogVisible: {
      type: Boolean,
      default: false
    },
    team: {
      type: Object,
      default: function() {
        return {}
      }
    }
  },

  data() {
    /* istanbul ignore next */
    const checkForUniqueness = (rule, value, callback) => {
      if (value.length === 0) {
        return callback('Team name is required')
      } else if (this.teamNameExists(value)) {
        return callback('Team names must be unique')
      }
      return callback()
    }
    return {
      // modalTitle: 'Create team',
      // isEditing: false,
      ruleForm: {
        name: ''
      },
      rules: {
        name: [
          { validator: checkForUniqueness, trigger: 'false' }
        ]
      }
    }
  },

  methods: {
    onOpen: function() {
      if (this.isEditing) {
        this.ruleForm.name = this.team.team.name
      }
    },
    /**
     * Handles key-pressed event
     * @param {Object} evt
     */
    onHandleKeyPressed: function(evt) {
      evt.preventDefault()
      this.createEditTeam('teamForm')
    },
    // /**
    //  * Handles open-edit-team and open-create-team events
    //  * @param {Object} team
    //  */
    // onOpenTeam: function(team) {
    //
    //   const teamName = pathOr('', ['team', 'name'], team)
    //   if (teamName.length > 0) {
    //     this.isEditing = true
    //     this.modalTitle = 'Update team'
    //     this.ruleForm.name = teamName
    //   }
    // },
    /**
     * Verifies that team name is unique
     * @param {String} name
     * @returns {Boolean}
     */
    teamNameExists: function(name) {
      const existingTeams = this.teams.filter(pathEq(['team', 'name'], name))
      return existingTeams.length > 0
    },
    /**
     * Create a team url
     * @param {String} method
     * @returns {String}
     */
    createUrl: function(method) {
      const teamId = method === 'PUT' ? `/${this.team.team.id}` : ''
      return `${this.config.apiUrl}/organizations/${this.activeOrganization.organization.id}/teams${teamId}?api_key=${this.userToken}`
    },
    /**
     * Closes remove member dialog
     */
    closeDialog: function() {
      this.$refs['teamForm'].resetFields()
      this.$emit('close-dialog')
    },
    /**
     * Makes XHR call to create/edit a team
     */
    createEditTeam: function(formName) {
      const teamName = path(['team', 'name'], this.team)
      this.$refs[formName].validate(valid => {
        if (!valid) {
          return
        } else if (this.ruleForm.name === teamName) {
          return this.closeDialog()
        }
        this.submitRequest()
      })
    },
    /**
     * Makes XHR call to create a team
     */
    submitRequest: function() {
      const method = this.team.team ? 'PUT' : 'POST'
      const msg = method === 'PUT' ? 'updated' : 'created'
      const url = this.createUrl(method)
      const teamId = pathOr(0, ['team', 'id'], this.team)
      this.sendXhr(url, {
        method,
        body: {
          name: this.ruleForm.name
        }
      })
      .then(team => {
        const responseId = path(['team', 'id'], team)
        const updatedTeam = {
          team: {
            id: method === 'PUT' ? teamId : responseId,
            name: this.ruleForm.name
          }
        }
        this.$emit(`team-${msg}`, updatedTeam)
        EventBus.$emit('toast', {
          detail: {
            type: 'info',
            msg: `${this.ruleForm.name} ${msg}`
          }
        })
        this.closeDialog()
      })
      .catch(this.handleXhrError.bind(this))
    },
  }
}
</script>
