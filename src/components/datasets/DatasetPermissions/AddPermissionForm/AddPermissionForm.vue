<template>
  <form id="addPermissionForm" class="add-permission-form">
    <div class="form-wrapper">
      <div class="invite-row">
        <el-select
          ref="select"
          v-model="permissionForm.item"
          class="mr-16"
          clearable
          @clear="clearForm"
          required
          filterable
          allow-create
          value-key="id"
          placeholder="Find individuals, teams, or enter email address..."
          popper-class="add-permission-form-dropdown"
          :no-match-text="`Can't find '${searchText}'`"
          @change="onChange"
        >
          <template #prefix>
            <IconMagnifyingGlass
              class="search-icon"
              :height="24"
              :width="24"
            />
          </template>


          <el-option-group label="External Person">
            <el-option
              v-if="externalProvided"
              class="add-permission-form-option"
              :label="externalPerson.email"
              :value="{
                        type: 'email',
                        id: externalPerson.id,
                        label: externalPerson.email
                      }"
            >
              <div class="name">
                <!-- eslint-disable-next-line --><!-- highlight sanitizes -->
                <span v-html="highlight(searchText, externalPerson.email)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="Organization">
            <el-option
              class="add-permission-form-option"
              :label="`Everyone at ${organizationName}`"
              :value="{
                        type: 'organizations',
                        id: organizationId,
                        label: `Everyone at ${organizationName}`
                      }"
            >
              <div class="name">
                <!-- eslint-disable-next-line --><!-- highlight sanitizes -->
                <span v-html="highlight(searchText, `Everyone at ${organizationName}`)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="People">
            <el-option
              v-for="item in filteredUsers"
              :key="item.id"
              class="add-permission-form-option"
              :label="`${fullName(item)} ${item.email}`"
              :value="{
                        type: 'users',
                        id: item.id,
                        label: fullName(item)
                      }"
            >
              <div class="name">
                <!-- eslint-disable-next-line --><!-- highlight sanitizes -->
                <span v-html="highlight(searchText, fullName(item))" />
              </div>
              <div class="email">
                <!-- eslint-disable-next-line --><!-- highlight sanitizes -->
                <span v-html="highlight(searchText, item.email)" />
              </div>
            </el-option>
          </el-option-group>

          <el-option-group label="Teams">
            <el-option
              v-for="item in filteredTeams"
              :key="item.team.id"
              class="add-permission-form-option"
              :label="item.team.name"
              :value="{
            type: 'teams',
            id: item.team.id,
            label: item.team.name
          }"
            >
              <div class="name">
                <!-- eslint-disable-next-line --><!-- highlight sanitizes -->
                <span v-html="highlight(searchText, item.team.name)" />
              </div>
            </el-option>
          </el-option-group>

        </el-select>

        <el-select
          ref="permissionSelect"
          v-model="permissionForm.role"
          class="mr-16 select-permission-input"
          placeholder="Select Permission"
          required
        >
          <el-option
            v-for="role in roles"
            :key="role.value"
            :label="role.label"
            :value="role.value"
          />
        </el-select>

        <bf-button
          :disabled="isFormInvalid || hasFeature('sandbox_org_feature')"
          :processing="processing"
          @click="submit"
          class="add-permission-button"
        >
          Add
        </bf-button>

        <confirm-role-dialog
          :dialog-visible="confirmDialogVisible"
          :role="permissionForm.role"
          @confirm="addPermission"
          @close-dialog="onCloseConfirmRoleDialog"
        />
      </div>
      <div v-if="externalProvided" class="external-user-message">
        The external user will be invited to the workspace as a "Guest". This gives the user full access to this dataset without making the user a full member of the workspace.
        If you want to invite a user to the workspace, use the "People" tab in the workspace.

        <span class="help-link">
          (
          <a
            href="https://docs.pennsieve.io/docs/workspace-management"
            target="_blank"
          >
            what is this?
          </a>
          )
        </span>
      </div>





      <el-input
        class="invite-message"
        v-if="inviteeSelected"
        v-model="permissionForm.message"
        :rows="4"
        type="textarea"
        placeholder="Enter a custom invite message..."
      />
    </div>


  </form>
</template>



<script>
  import {
    mapState,
    mapGetters
  } from 'vuex'
  import {
    propOr,
    pathOr,
    clone,
    findIndex,
    pathEq,
    propEq
  } from 'ramda'

  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import ConfirmRoleDialog from '../../collaborators/ConfirmRoleDialog/ConfirmRoleDialog.vue'

  import HighlightText from '../../../../mixins/highlight-text'
  import Sorter from '../../../../mixins/sorter'
  import IconMagnifyingGlass from "../../../icons/IconMagnifyingGlass.vue";

  const defaultForm = {
    item: {
      id: '',
      label: '',
      type: ''
    },
    role: '',
    message: ''
  }

  export default {
    name: 'AddPermissionForm',

    components: {
      IconMagnifyingGlass,
      BfButton,
      ConfirmRoleDialog
    },

    mixins: [
      HighlightText,
      Sorter
    ],

    props: {
      processing: {
        type: Boolean,
        default: false
      },
      collaborators: {
        type: Array,
        default: function() {
          return []
        }
      }
    },

    data() {
      return {
        permissionForm: {
                        item: {
                          id: '',
                          label: '',
                          type: ''
                        },
                        role: '',
                        message: ''
                      },
        searchText: '',
        roles: [
          {
            label: 'Can Manage',
            value: 'Manager'
          },
          {
            label: 'Can Edit',
            value: 'Editor'
          },
          {
            label: 'Can View',
            value: 'Viewer'
          }
        ],
        confirmDialogVisible: false,
        externalProvided: false,
        externalPerson: {}
      }
    },

    computed: {
      ...mapState([
        'orgMembers',
        'teams',
        'activeOrganization'
      ]),

      ...mapGetters([
        'hasFeature'
      ]),

      /**
       * Compute if the form is in an invalid state
       * @returns {Boolean}
       */
      isFormInvalid: function() {
        const id = pathOr('', ['item', 'id'], this.permissionForm)
        const role = propOr('', 'role', this.permissionForm)

        return id === '' || role === ''
      },

      inviteeSelected: function() {
        const id = pathOr('', ['item', 'id'], this.permissionForm)
        return id !== ''
      },

      /**
       * Compute users list without users who have already been added
       * @returns {Array}
       */
      filteredUsers: function() {
        return this.filterAndSort(['id'], this.orgMembers, 'lastName')
      },

      /**
       * Compute teams list without users who have already been added
       * @returns {Array}
       */
      filteredTeams: function() {
        return this.filterAndSort(['team', 'id'], this.teams, 'team.name').filter(t => !t.team.systemTeamType)
      },

      /**
       * Compute organization's name
       * @returns {String}
       */
      organizationName: function() {
        return pathOr('Organization', ['organization', 'name'], this.activeOrganization)
      },

      /**
       * Compute organization's ID
       * @returns {String}
       */
      organizationId: function() {
        return pathOr('', ['organization', 'id'], this.activeOrganization)
      }
    },

    watch: {
      /**
       * Watch label and set it as the display value
       */
      'permissionForm.item.label': function() {
        this.setDisplayValue()
      }
    },

    mounted: function() {
      // Set up watcher for select query
      this.$watch(
        () => {
          return this.$refs.select.query
        }, (val) => {
          this.searchText = val
        }
      )
    },

    methods: {
      /**
       * Filter and sort a list based on another list
       * Used for filtering teams or users from roles that have already been added
       * @param {Array} path
       * @param {Array} list
       * @param {String} sortBy
       * @returns {Array}
       */
      filterAndSort: function(path = [], list = [], sortBy = '') {
        let newList = clone(list)
        // Go through all collaborators and remove them from the orgMembers list
        this.collaborators.forEach(item => {
          const id = pathOr('', path, item)
          const idx = findIndex(pathEq(path, id), newList)
          if (idx >= 0) {
            newList.splice(idx, 1)
          }
        })

        // Sort filtered list
        return this.returnSort(sortBy, newList, 'asc')
      },

      /**
       * Format display name for relationship and set it as the `selectedLabel`
       */
      setDisplayValue: function() {
        this.$nextTick(() => {
          const label = pathOr('', ['item', 'label'], this.permissionForm)
          this.$refs.select.selectedLabel = label
        })
      },
      /**
       * Builds the user's full name
       * @param {Object} member
       */
      fullName: function(member) {
        const firstName = propOr('', 'firstName', member)
        const lastName = propOr('', 'lastName', member)
        return `${firstName} ${lastName}`
      },

      /**
       * Emit an event with the form's info
       */
      submit: function() {
        const role = propOr('', 'role', this.permissionForm)

        if (role !== 'viewer') {
          this.confirmDialogVisible = true
          return
        }

        this.addPermission()
      },

      /**
       * Reset form
       */
      reset: function() {
        this.permissionForm = structuredClone(defaultForm)
      },

      /**
       * Emit event to add permission
       */
      addPermission: function() {
        this.$emit('submit', this.permissionForm)
        this.confirmDialogVisible = false
      },

      /**
       * Change callback for the select input
       * @param {Object} item
       */
      onChange: function(item) {
        if (item && typeof(item) === 'string') {
          this.checkForExternal(item)
        } else {
          this.externalProvided = false
          this.externalPerson = {}
        }
      },

      clearForm: function() {
        this.externalProvided = false
        this.externalPerson = {}
      },

      validateEmail: function(email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },

      checkForExternal: function(input) {
        if (this.validateEmail(input) !== null) {
          this.externalPerson = {
            email: input,
            id: 'N:email:00000000-0000-0000-0000-000000000000'
          }
          this.externalProvided = true
          this.permissionForm.item = {
            id: this.externalPerson.id,
            label: this.externalPerson.email,
            type: 'external'
          }
        }
        else {
          this.externalProvided = false
        }
      },
      onCloseConfirmRoleDialog: function(){
        this.confirmDialogVisible = false;
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../../assets/_variables.scss';

  .select-permission-input {
    width: 300px;
  }

  .add-permission-button {
    min-width: unset;
    width: 150px;
  }

  .form-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;

    .invite-row {
      display: flex;
      flex: 1;
    }

    .external-user-message {
      margin: 16px 0 8px 0  ;
      color: $purple_1;
      font-weight: 300;
    }
  }

  .invite-message {
    margin-top: 8px;

  }
  .add-permission-form {
    display: flex;
    flex-wrap: wrap;
    .el-input__prefix {
      display: flex !important;
      .svg-icon {
        align-self: center;
      }
    }
  }

  .add-permission-form-dropdown {
    .el-select-group__title {
      color: #000;
      font-size: 12px;
      font-weight: 700;
      line-height: inherit;
      padding: 8px 16px;
      text-transform: none;
    }

    .add-permission-form-option {
      color: #000;
      font-size: 12px;
      padding: 8px 16px;
      &.hover, &.selected {
        cursor: pointer;
        color: $white;
        background: $purple_1;

        .email {
          color: $white;
        }
      }
      .email {
        color: $gray_6
      }
    }
  }
</style>
