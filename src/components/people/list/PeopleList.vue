<template>
<!--  <bf-page class="bf-people-list">-->



    <bf-stage
      slot="stage"
      v-loading="isLoading"
      element-loading-background="transparent"
    >
      <template #actions>
          <bf-button
            v-if="hasAdminRights"
            @click="openDialog"
          >
            Send Invitation
          </bf-button>
      </template>


      <div class="pagination-header mb-16">
        <pagination-page-menu
          class="mr-24"
          pagination-item-label="Results"
          :page-size="limit"
          @update-page-size="onUpdateLimit"
        />
        <el-pagination
          :page-size="limit"
          :pager-count="5"
          :current-page="offset / limit + 1"
          layout="prev, pager, next"
          :total="allPeople.length"
          @current-change="onPaginationPageChange"
        />
      </div>
      <div
        v-if="people.length > 0"
        class="bf-table"
      >
        <div class="bf-table-header">
          <el-row
            type="flex"
            align="middle"
            :gutter="32"
          >
            <el-col
              :sm="8"
              class="info"
            >
              <button
                :class="[isSorting('lastName') ? 'sort-active' : '']"
                @click="sortColumn('lastName')"
              >
                Name
                <IconSort
                  :isVisible="this.isSorting('lastName')"
                  :class="[ this.sortDirection === 'desc' ? 'svg-flip' : '' ]"
                />
              </button>
            </el-col>
            <el-col
              :sm="8"
            >
              <button
                :class="[isSorting('role') ? 'sort-active' : '']"
                @click="sortColumn('role')"
              >
                Role
                <IconSort
                  :isVisible="this.isSorting('role')"
                  :class="[ this.sortDirection === 'desc' ? 'svg-flip' : '' ]"
                />
              </button>
            </el-col>
            <el-col
              :sm="6"
              :pull="6"
              class="menu"
            />
          </el-row>
        </div>
        <div>
          <org-member
            v-for="member in people"
            :key="member.id"
            class="bf-table-row"
            :item="member"
            :has-admin-rights="hasAdminRights"
            @promote-to-admin="onPromoteToAdmin"
            @demote-from-admin="onDemoteFromAdmin"
            @promote-publisher="onPromoteToPublisher"
            @demote-publisher="onDemoteFromPublisher"
          />
        </div>
      </div>

      <invite-member
        :dialog-visible="isInviteVisible"
        :header="modalHeader"
        :all-org-members="people"
        @member-invited="onHandleMemberInvited"
        @close-invite-dialog="onCloseInviteDialog"
      />

      <edit-member
        @member-updated="onMemberUpdated"
      />

      <remove-member
        @member-removed="onMemberRemoved"
      />
    </bf-stage>
<!--  </bf-page>-->
</template>

<script>
import {mapActions, mapGetters} from 'vuex'

import BfRafter from '../../shared/bf-rafter/BfRafter.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import OrgMember from '../org-member/OrgMember.vue'
import EditMember from '../windows/EditMember.vue'
import RemoveMember from '../windows/RemoveMember.vue'
import InviteMember from '../windows/InviteMember.vue'
import PaginationPageMenu from '../../shared/PaginationPageMenu/PaginationPageMenu.vue'


import {findIndex, propEq, propOr, reject, union} from 'ramda'
import Sorter from '../../../mixins/sorter'
import UserRoles from '../../../mixins/user-roles'
import Request from '../../../mixins/request'
import IconSort from "../../icons/IconSort.vue";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'PeopleList',

  components: {
    IconSort,
    BfRafter,
    BfButton,
    OrgMember,
    EditMember,
    RemoveMember,
    InviteMember,
    PaginationPageMenu
  },

  mixins: [
    Sorter,
    UserRoles,
    Request,
  ],

  data() {
    return {
      isInviteVisible: false,
      modalHeader: 'Invite Team Member',
      allPeople: [],
      offset: 0,
      limit: 25,
      members: [],
      invitations: [],
      sortDirection: "asc"
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'orgMembers',
      'config',
      'hasFeature',
      'profile'
    ]),
    hasAdminRights: function() {
      const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
      const isOwner = propOr(false, 'isOwner', this.activeOrganization)
      return isAdmin || isOwner
    },
    /**
     * the displayed subset of allPeople based on which page in the paginated list we are on
     */
    people: function() {
      return this.allPeople.slice(this.offset, this.offset + this.limit)
    }
  },

  watch: {
    orgMembers: {
      handler: function(orgMembers) {
        if (orgMembers.length > 0) {
          this.members = orgMembers
          this.getUsers()
        }
      },
      immediate: true
    }
  },

  beforeRouteEnter(to, from, next) {
    next(vm => {
     if (vm.hasFeature('sandbox_org_feature')) {
      vm.$router.push({name: 'create-org'})
    }
    })
  },

  methods: {
    ...mapActions([
      'updateOrgMembers'
    ]),

    /**
     * Handles member-invited event
     */
    onHandleMemberInvited: function(newMember) {
      const updatedList = this.allPeople.concat([newMember])
      this.allPeople = this.returnSort(this.sortBy, updatedList, this.sortDirection)
    },
    /**
     * Generates invited org members GET url
     */
    getInvitedPeopleUrl: async function() {
      return useGetToken()
        .then(token => {
          return `${this.config.apiUrl}/organizations/${this.activeOrganization.organization.id}/invites?api_key=${token}`
        })
        .catch(() => {
          return undefined
        })
    },
    /**
     * Updates org member
     * @param {Object} member
     */
    onMemberUpdated: function(member) {
      const role = this.getOrgRole(member, this.activeOrganization)
      const updatedMember = Object.assign({}, member, { role })
      const idx = findIndex(propEq('id', member.id), this.allPeople)
      this.allPeople.splice(idx, 1, updatedMember)
      this.allPeople = this.returnSort(this.sortBy, this.allPeople, this.sortDirection)
      this.updateOrgMembers(this.allPeople)
    },
    /**
     * Promotes user to administrator
     * @param {Object} member
     */
    onPromoteToAdmin: function(member) {
      const updatedPeople = this.allPeople.map(p => p.id === member.id ? { ...p, role: 'manager' } : p)
      this.allPeople = this.returnSort(this.sortBy, updatedPeople, this.sortDirection)
      this.updateOrgMembers(this.allPeople)
    },
    /**
     * Demotes user from administrator to collaborator
     * @param {Object} member
     */
    onDemoteFromAdmin: function(member) {
      const updatedPeople = this.allPeople.map(p => p.id === member.id ? { ...p, role: 'editor' } : p)
      this.allPeople = this.returnSort(this.sortBy, updatedPeople, this.sortDirection)
      this.updateOrgMembers(this.allPeople)
    },

    /**
     * Promotes user to publisher status
     * @param {Object} member
     */
    onPromoteToPublisher: function(member) {
      const updatedPeople = this.allPeople.map(p => p.id === member.id ? { ...p, isPublisher: true } : p)
      this.allPeople = this.returnSort(this.sortBy, updatedPeople, this.sortDirection)
      this.updateOrgMembers(this.allPeople)
    },

    /**
     * Demotes user from publisher status
     * @param {Object} member
     */
    onDemoteFromPublisher: function(member) {
      const updatedPeople = this.allPeople.map(p => p.id === member.id ? { ...p, isPublisher: false } : p)
      this.allPeople = this.returnSort(this.sortBy, updatedPeople, this.sortDirection)
      this.updateOrgMembers(this.allPeople)
    },
    /**
     * Removes deleted member from people list
     * @param {Object} member
     */
    onMemberRemoved: function(member) {
      this.allPeople = reject(propEq('id', member.id), this.allPeople)
      this.updateOrgMembers(this.allPeople)
    },
    /**
     * Makes call to resort table by column
     * @param {String} key
     */
    sortColumn: function(key) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
      this.offset = 0
      this.allPeople = this.returnSort(key, this.allPeople, this.sortDirection)
    },
    /**
     * Updates pending users object with any missing fields required for sorting
     * @param {Array} users
     * @returns {Array}
     */
    updatePendingMembers: function(users) {
      return users.map(member => {
        const newFields = {
          pending: true,
          lastName: '',
          storage: 0,
          role: member.permission
        }
        return Object.assign({}, newFields, member)
      })
    },
    /**
     * Updates current users object with any missing fields required for sorting
     * @param {Array} users
     * @returns {Array}
     */
    updateCurrentMembers: function(users) {
      return users.map(member => {
        const role = this.getOrgRole(member, this.activeOrganization)
        let newFields = { role }
        if (!member.storage) {
          newFields = {
            storage: 0,
            role
          }
        }
        return Object.assign({}, newFields, member)
      })
    },
    /**
     * Creates XHR calls to get invited users and current organization members
     */
    getUsers: async function() {

      this.getInvitedPeopleUrl()
        .then(url => {
          const peoplePromise = Promise.resolve(this.orgMembers)
          const invitesPromise = this.hasAdminRights ? this.sendXhr(url) : Promise.resolve([])

          return Promise.all([invitesPromise, peoplePromise])
            .then(values => {
              this.isLoading = false // ensure this is reset if there are no promises executed
              this.invitations = values[0]
              const pendingMembers = this.updatePendingMembers(values[0])
              const currentMembers = this.updateCurrentMembers(values[1])
              const allUsers = union(pendingMembers, currentMembers)
              if (this.allPeople.length !== this.orgMembers.length) {
                this.allPeople = this.returnSort('lastName', allUsers, this.sortDirection)
              } else {
                this.allPeople = allUsers
              }
            })

        }).catch(this.handleXhrError.bind(this))
    },

    /**
     * Opens the dialog
     */
    openDialog: function() {
      this.modalHeader = 'Invite Team Member'
      this.isInviteVisible = true
    },

    /**
     * Handles closing of the invite dialog
     */
    onCloseInviteDialog: function() {
      this.isInviteVisible = false
      this.modalHeader = ''
    },

    /**
     * handle changing the page
     * @param {Number} page
     */
    onPaginationPageChange: function(page) {
      this.offset = (page - 1) * this.limit
    },

    /**
     * handle changing the results per page
     * @param {Number} page
     */
    onUpdateLimit: function(limit) {
      this.offset = 0
      this.limit = limit
    }
  }
}
</script>

<style scoped lang="scss">

.data-usage {
  text-align: right;
}
.col-spacer {
  height: 17px;
}
.pagination-header {
  display: flex;
  justify-content: space-between
}
</style>
