<template>
  <div class="el-dialog">
    <el-dialog
      class="dark-header"
      :show-close="false"
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      @open="autoFocus"
      @close="closeDialog"
    >
      <template #header="{ close, titleId, titleClass }">
        <bf-dialog-header
          :title="header"
        />
      </template>

      <dialog-body ref="abcd">
        <el-form
          ref="invitationForm"
          :model="ruleForm"
          :rules="rules"
          label-position='top'
          @submit.native.prevent="sendInvite('invitationForm')"
        >
          <el-form-item
            label="First Name"
            prop="firstName"
          >
            <el-input
              v-model="ruleForm.firstName"
              autofocus
            />
          </el-form-item>
          <el-form-item
            label="Last Name"
            prop="lastName"
          >
            <el-input v-model="ruleForm.lastName" />
          </el-form-item>
          <el-form-item
            label="Email Address"
            prop="email"
          >
            <el-input v-model="ruleForm.email" />
          </el-form-item>
          <el-form-item
            label="Message (Optional)"
            prop="customMessage"
          >
            <el-input
              type="textarea"
              :rows="4"
              placeholder="Enter a custom invite message..."
              v-model="ruleForm.customMessage" />
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
        <bf-button @click="sendInvite('invitationForm')">
          Confirm
        </bf-button>
      </template>

    </el-dialog>

    <invite-confirmation
      :is-visible="confirmationModalVisible"
      :email="emailVal"
      @close-confirmation-dialog="onCloseConfirmationDialog"
    />

  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
// import A11yKeys from '../../shared/a11y-keys/A11yKeys.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import Request from '../../../mixins/request'
import AutoFocus from '../../../mixins/auto-focus'
import EventBus from '../../../utils/event-bus'
import InviteConfirmation from './InviteConfirmation.vue'
import { pathOr, path, find, propEq, defaultTo } from 'ramda'
import {useSendXhr} from "@/mixins/request/request_composable";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'InviteMember',

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
    InviteConfirmation
  },

  mixins: [
    Request,
    AutoFocus
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    allOrgMembers: {
      type: Array,
      default: () => []
    },
    header: {
      type: String,
      default: ''
    },
    blindReviewerInvitation: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      confirmationModalVisible: false,
      labelPosition: 'right',
      emailVal: '',
      ruleForm: {
        firstName: '',
        lastName: '',
        email: '',
        customMessage: '',
        inviteRole: '1'
      },
      rules: {
        firstName: [
          { required: true, message: 'Please provide a first name', trigger: 'false' },
        ],
        lastName: [
          { required: true, message: 'Please provide a last name', trigger: 'false' }
        ],
        email: [
          { type: 'email', validator: this.checkEmail, trigger: 'false' }
        ]
      }
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'config'
    ]),

  },

  methods: {

    onCloseConfirmationDialog: function() {
      this.confirmationModalVisible = false
    },
    /**
     * Checks user email to ensure that it is required and not already an existing member of the org
     * @param {Object} rule
     * @param {String} value
     * @param {Function} callback
     */
    checkEmail: function(rule, value, callback) {
      // make sure it has a value
      if (value.length === 0) {
        callback(new Error('Please provide a valid email address'))
      }
      // ensure that the user invited is not already a member of the org
      const normalizedEmail = value.toLowerCase()
      const list = defaultTo([], this.allOrgMembers)
      const matchingMembers = list.filter(member => member.email.toLowerCase() === normalizedEmail)
      if (matchingMembers.length > 0) {
        callback(new Error('That email already exists in this organization'))
      }
      callback()
    },

    /**
     * Handles key-pressed event
     */
    onHandleKeyPressed: function() {
      this.sendInvite('invitationForm')
    },

    /**
     * Sends invitation to join the organization
     * @param {String} formName
     */
    sendInvite: function(formName) {
      this.$refs[formName]
        .validate((valid) => {
          if (valid) {
            this.sendRequest()
          }
        })
    },

    /**
     * Sends XHR request to submit invitation
     */
    getRole: function() {
      if (this.ruleForm.inviteRole === '2') {
        return 'guest'
      }
      else {
        return ''
      }
    },

    getInvitedRole: function() {
      if (this.ruleForm.inviteRole === '2') {
        return 'Guest'
      }
      else {
        return 'Collaborator'
      }
    },

    sendRequest: function() {
      let role = this.getRole()
      let userInvite = this.ruleForm
      delete userInvite.role
      if (this.blindReviewerInvitation) {
        role = 'blind_reviewer'
      }
      this.emailVal = this.ruleForm.email

      useGetToken()
        .then(token => {
          const activeOrgId = pathOr('', ['organization', 'id'], this.activeOrganization)
          const url = `${this.config.apiUrl}/organizations/${activeOrgId}/members?api_key=${token}`

          return useSendXhr(url, {
            method: 'POST',
            body: {
              invites: [
                userInvite
              ],
              role: role
            }
          })
            .then(this.handleSucessfulInvite.bind(this))
        })
        .catch(this.handleXhrError.bind(this))
    },

    /**
     * Handles getting new member info from either API response or form
     *
     */
    getNewMemberInfo: function(response) {
      const email = this.ruleForm.email
      // invited an existing Pennsieve user
      const newMember = path([email, 'user'], response)
      if (newMember) {
        return newMember
      }
      // invited a new user to the Pennsieve platform
      const invitedUser = {
        firstName: this.ruleForm.firstName,
        lastName: this.ruleForm.lastName,
        email
      }
      return invitedUser
    },

    /**
     * Handles invitation success
     * @param {}
     */
    handleSucessfulInvite: function(response) {
      const memberExtras = {
        role: this.getInvitedRole().toLowerCase(),
        storage: 0,
        pending: true
      }
      const newMember = this.getNewMemberInfo(response)
      this.$emit('member-invited', Object.assign({}, memberExtras, newMember))
      if (this.blindReviewerInvitation) {
        this.confirmationModalVisible = true
        this.dialogVisible = false
      } else {
        EventBus.$emit('toast', {
          detail: {
            type: 'MESSAGE',
            msg: 'Invitation sent'
          }
        })
        this.closeDialog()
      }

    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.ruleForm.inviteRole = '1'
      this.$emit('close-invite-dialog')
      this.$refs.invitationForm.resetFields()
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/element/dialog';
@use '../../../styles/theme';

:deep(.el-dialog) {
  --el-dialog-bg-color: red;
}

</style>

