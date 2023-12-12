<template>
  <div>
    <el-row
      class="member"
      type="flex"
      :gutter="32"
    >
      <el-col
        :sm="10"
        class="member-col info"
      >
        <collaborator-label :item="item" />
      </el-col>
      <el-col
        class="member-col administrator"
        align="right"
        :sm="4"
      >
        <template v-if="canEditCollaborator">
          <el-dropdown
            trigger="click"
            placement="bottom-end"
            @command="onRoleSelect"
            @visible-change="isRoleMenuOpen = $event"
          >
            <button>
              <span class="role">
                {{ role }}
              </span>
              <IconArrowUp
                :class="[ roleArrowDir  ? 'svg-flip' : '' ]"
                :height="10"
                :width="10"
              />
            </button>
            <template #dropdown>
              <el-dropdown-menu
                class="bf-menu"
              >
                <el-dropdown-item
                  v-for="roleItem in rolesForEntity"
                  :key="roleItem.value"
                  class="role icon-item"
                  :command="roleItem.value"
                >
                  {{ roleItem.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <span class="role">
            {{ role }}
          </span>
        </template>
      </el-col>
      <el-col
        class="member-col menu"
        :sm="10"
      >
        <button
          v-if="canEditCollaborator && !isRemovingUser"
          class="tools"
          @click="removeCollaborator"
        >
          <IconRemove
            :height="12"
            :width="12"
            color="currentColor"
          />
        </button>

      </el-col>
    </el-row>

    <confirm-role-dialog
      :dialog-visible="confirmDialogVisible"
      :role="updatedRole"
      :entity="item.entity"
      :current-role="role"
      :member-name="fullName"
      @confirm="updateRole"
      @close="closeDialog"
    />
  </div>
</template>

<script>
  import { mapGetters, mapState } from 'vuex';

  import CollaboratorLabel from '../../../shared/collaborator-label/CollaboratorLabel.vue'
  import ConfirmRoleDialog from '../ConfirmRoleDialog/ConfirmRoleDialog.vue'

  import { prop, propOr, defaultTo } from 'ramda'
  import IconArrowUp from "../../../icons/IconArrowUp.vue";
  import IconRemove from "../../../icons/IconRemove.vue";

export default {
  name: 'DatasetCollaborator',

  components: {
    IconRemove,
    IconArrowUp,
    CollaboratorLabel,
    ConfirmRoleDialog
  },

  props: {
    item: {
      type: Object,
      default: () => {}
    },
    hasAdminRights: {
      type: Boolean,
      default: false
    },
  },

  data() {
    return {
      isRemovingUser: false,
      isRoleMenuOpen: false,
      roles: [
        {
          label: 'Make Owner',
          value: 'owner'
        },
        {
          label: 'Manager',
          value: 'manager'
        },
        {
          label: 'Editor',
          value: 'editor'
        },
        {
          label: 'Viewer',
          value: 'viewer'
        }
      ],
      confirmDialogVisible: false,
      updatedRole: ''
    }
  },

  computed: {
    ...mapState([
      'datasetRole',
      'dataset'
    ]),

    ...mapGetters([
      'getPermission',
      'isUserSuperAdmin'
    ]),

    /**
     * Compute the member's full name
     * @returns {String}
     */
    fullName: function() {
      const firstName = propOr('', 'firstName', this.item)
      const lastName = propOr('', 'lastName', this.item)
      return `${firstName} ${lastName}`
    },

    /**
     * Compute if the collaborator is a user
     * @returns {Boolean}
     */
    isUser: function() {
      const team = prop('email', this.item)
      return Boolean(team)
    },

    /**
     * Filter roles for entity
     * Allow Owners, and SuperAdmins to change ownership of a dataset
     *
     * Only users can become owners of a dataset
     * @returns {Array}
     */
    rolesForEntity: function() {
      const noOwnerRole = this.roles.filter(role => role.value !== 'owner')

      const userRoles = (this.datasetRole === 'owner' || this.isUserSuperAdmin)
        ? this.roles
        : noOwnerRole

      return this.isUser
        ? userRoles
        : noOwnerRole
    },

    /**
     * Compute arrow direction for role menu
     * @returns {String}
     */
    roleArrowDir: function() {
      return this.isRoleMenuOpen ? 'up' : 'down'
    },

    /**
     * Compute if the current user can edit role
     */
    canEditCollaborator: function() {
      const role = propOr('viewer', 'permission', this.item)
      return (this.getPermission('manager') || this.isUserSuperAdmin) && role !== 'owner' && !this.isSystemTeam
    },

    isSystemTeam: function() {
      return this.item && this.item.team && !!this.item.team.systemTeamType
    },

    /**
     * Compute label for role
     * @returns {String}
     */
    role: function() {
      const oldRole = this.item.role === 'Administrator' ? 'Collaborator' : this.item.role
      const role = propOr('', 'permission', this.item)
      return defaultTo(oldRole, role)

    }
  },

  methods: {
    closeDialog: function() {
      this.confirmDialogVisible = false
    },
    /**
     * Remove collaborator from dataset
     */
    removeCollaborator: function() {
      this.isRemovingUser = true
      this.$emit('remove-permission', this.item)
    },

    /**
     * Emit event to update the role of the user
     * @params {Object} evt
     */
    onRoleSelect: function(evt) {
      const role = propOr('', 'permission', this.item)
      if (evt !== role) {
        this.updatedRole = evt

        this.confirmDialogVisible = true
      }
    },

    updateRole: function() {
      this.confirmDialogVisible = false

      this.$emit('update-role', {
        item: this.item,
        role: this.updatedRole
      })

      this.updatedRole = ''
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/variables';

:deep(.el-dialog__footer) {
  display: flex;
}

.member-col {
  color: $gray_4;

  &.menu {
    display: flex;
    justify-content: flex-end;
  }
  button {
    color: $gray_4;
    white-space: nowrap;
  }
}

.no-shrink {
  flex-shrink: 0;
}

.member {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
	height: 40px;
}
.role {
  font-family: $system-font;
  text-transform: capitalize;
  font-size: 14px;
  font-weight: 300;
  margin-right: 8px;
}
</style>
<style lang="scss">
  @import '../../../../assets/_variables.scss';

  .member .el-spinner-inner .path {
    stroke: $gray_4
  }
</style>
