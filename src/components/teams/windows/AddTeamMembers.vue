<template>
  <el-dialog
    class="add-member-dialog"
    :show-close="false"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    @open="resetForm()"
    @close="closeDialog"
  >

    <template #header="{ close, titleId, titleClass }">
      <bf-dialog-header
        slot="title"
        title="Add Team Member"
      />
    </template>

    <dialog-body>
      <div class="team-name-wrapper">
        <IconTeam
          class="team-icon"
          :height="20"
          :width="20"
          />
        <div class="team-name">
          Adding to {{ teamName }}
        </div>
      </div>

      <el-autocomplete
        class="add-member-input"
        v-model="searchText"
        placeholder="Find by name or email address"
        :fetch-suggestions="filterMembers"
        popper-class="pennsieve-autocomplete"
        @select="selectMember"
        >
        <template #prefix>
          <div
            slot="prefix"
            class="search-icon-wrapper"
          >
            <IconMagnifyingGlass
              :height="24"
              :width="24"
            />

          </div>
        </template>
        <template #default="{ item }">
          <div class="name">
            <span v-html="highlight(searchText, fullName(item))" />
          </div>
          <div class="email">
            <span v-html="highlight(searchText, item.email)" />
          </div>
        </template>

      </el-autocomplete>

      <div class="org-members">
        <team-member
          v-for="member in selectedMembers"
          :key="member.id"
          :item="member"
          :remove-from-list="true"
          @remove-member-from-list="onRemoveMemberFromList"
        />
      </div>
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
        @click="addToTeam()"
      >
        Add to Team
      </bf-button>

    </template>

  </el-dialog>
</template>


<script>
import { mapGetters } from 'vuex'

import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import TeamMember from '../members/TeamMember.vue'

import Request from  '../../../mixins/request'
import Sorter from  '../../../mixins/sorter'
import EventBus from '../../../utils/event-bus'
import HighlightText from '../../../mixins/highlight-text'
import { pathOr, propOr, find, propEq } from 'ramda'
import IconTeam from "../../icons/IconTeam.vue";
import IconMagnifyingGlass from "../../icons/IconMagnifyingGlass.vue";

export default {
  name: 'AddTeamMembers',

  components: {
    IconMagnifyingGlass,
    IconTeam,
    BfButton,
    TeamMember,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    Sorter,
    Request,
    HighlightText
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
    team: {
      type: Object,
      default: function() {
        /* istanbul ignore next */
        return {}
      }
    },
    members: {
      type: Array,
      default: function() {
        /* istanbul ignore next */
        return []
      }
    }
  },

  data() {
    return {
      filteredMembers: [],
      selectedMembers: [],
      origMembers: [],
      searchText: "",
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'profile',
      'userToken',
      'config',
      'orgMembers'
    ]),
    teamName: function() {
      return pathOr('', ['team', 'name'], this.team)
    }
  },

  methods: {
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
     * Add users to team
     */
    addToTeam: function() {
      this.addToTeamRequest()
    },
    /**
     * Creates the add to team
     */
    addToTeamUrl: function() {
      const orgId = pathOr('', ['organization', 'id'], this.activeOrganization)
      const teamId = pathOr(0, ['team', 'id'], this.team)
      const apiUrl = propOr('', 'apiUrl', this.config)
      return `${apiUrl}/organizations/${orgId}/teams/${teamId}/members?api_key=${this.userToken}`
    },
    /**
     * Makes XHR call to add members to team
     */
    addToTeamRequest: function() {
      const ids = this.selectedMembers.map(mem => mem.id)
      if (ids.length === 0) {
        return
      }
      this.sendXhr(this.addToTeamUrl(), {
        method: 'POST',
        body: { ids }
      })
        .then(members => {
          this.closeDialog()
          this.$emit('members-added-to-team', members)
          EventBus.$emit('toast', {
            detail: {
              type: 'info',
              msg: `Team member(s) added for ${this.teamName}`
            }
          })
        })
        .catch(this.handleXhrError.bind(this))
    },
    /**
     * Selects member to add to team
     * @param {Object} member
     */
    selectMember: function(member) {
      this.selectedMembers.push(member)
      this.filteredMembers = this.filteredMembers.filter(fm => fm.id !== member.id)
    },
    /**
     * Removes a team member from filtered list
     * @param {Object} member
     */
    onRemoveMemberFromList: function(member) {
      this.selectedMembers = this.selectedMembers.filter(mem => mem.id !== member.id)
    },
    /**
     * Filters org members based on searchText
     */
    filterMembers: function() {
      const originalList = this.orgMembers.filter(orig => {
        const existingMember = find(propEq('id', orig.id), this.members)
        const guestUser = orig.role === 'guest'
        return !existingMember && !guestUser
      })

      const searchText = this.searchText.toLowerCase()
      const list = originalList.filter(member => {
        const selectedMember = find(propEq('id', member.id), this.selectedMembers)
        return !selectedMember
      })
      const filteredList = list.filter(mem => {
        const firstName = propOr('', 'firstName', mem)
        const lastName = propOr('', 'lastName', mem)
        const name = `${firstName} ${lastName}`.toLowerCase()
        const email = propOr('', 'email', mem).toLowerCase()
        return name.indexOf(searchText) >= 0 || email.indexOf(searchText) >= 0
      })
      return filteredList.length > 0 ? filteredList : []
    },
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.filteredMembers = []
      this.selectedMembers = []
      this.$emit('close-dialog')
    },
    /**
     * Resets form fields and validations
     */
    resetForm: function() {
      this.searchText = ''
    },
  }
}
</script>

<style lang="scss">
@import '../../../assets/_variables.scss';

.add-member-input {
  width:100%
}

.add-member-dialog {
  .search-icon-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .search-icon {
      color: $gray_4;
    }
  }

  .org-members {
    box-sizing: border-box;
    margin-top: 8px;
    padding: 8px;
    border: 1px solid $gray_2;
    border-radius: 3px;
    height: 200px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .team-name-wrapper {
    display: flex;
    margin-bottom: 26px;

    .team-name {
      font-size: 14px;
      line-height: 20px;
      margin-left: 8px;
      color: #000;
    }
  }

  .team-icon {
    color: $purple_1;
  }

  .collaborators-icon {
    color: $purple_1;
  }

  .el-dialog__body {
    position: relative;
  }

  .autocomplete {
    width: 100%;
    max-width: 474px;
    max-height: 225px;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0;

    h4 {
      margin: 8px 0 8px 8px;
    }

    ul {
      margin: 0;
      padding: 0;

      li {
        margin: 0;
        padding: 8px;

        .email {
          color: $gray_6;
        }

        &:hover {
          cursor: pointer;
          color: $white;
          background: $purple_1;

          .email {
            color: $white;
          }
        }
      }
    }
  }
}

.filtered-member {
  margin: 8px;
  padding: 8px;
}
</style>
