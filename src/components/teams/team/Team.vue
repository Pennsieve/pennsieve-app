<template>
  <div>
    <el-row
      type="flex"
      class="team"
      :gutter="32"
    >
      <el-col
        :span="12"
        class="team-col"
      >
        <div class="team-info">
          <IconTeam class="circle-icon team-avatar" :width="16" :height="16"/>

          <div class="team-details">
            <div class="name">
              <router-link
                v-if="!removeFromList"
                :to="{ name: 'team-members-list', params: { id: createTeamId(item) }}"
              >
                {{ teamName }}
              </router-link>
              <span v-if="removeFromList">
                {{ teamName }}
              </span>
            </div>
            <div class="members">
              {{ memberCount }}
            </div>
          </div>
        </div>
      </el-col>
      <el-col
        :span="8"
        class="team-col"
      >
        <div class="team-info">
          <div class="team-details">
            <div class="members">
              <span>{{ systemTeamType }}</span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col
        :span="4"
        class="align-right"
      >
        <button
          v-if="removeFromList"
          class=""
          @click="openDeleteDialog(item)"
        >
          <IconRemove
            :height="10"
            :width="10"
          />

        </button>
        <el-dropdown
          v-if="hasAdminRights"
          trigger="click"
          placement="bottom-end"
          @command="onTeamMenu"
        >
          <span class="btn-file-menu el-dropdown-link">
            <IconMenu
              :height="20"
              :width="20"
            />
          </span>
          <template #dropdown>
            <el-dropdown-menu
              slot="dropdown"
              class="bf-menu"
              :offset="9"
            >
              <el-dropdown-item command="changeRoute">
                Update team
              </el-dropdown-item>
              <el-dropdown-item
                v-if="!systemTeamType"
                command="openDeleteDialog"
              >
                Delete team
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import Avatar from '../../shared/avatar/Avatar.vue'

import EventBus from '../../../utils/event-bus'
import { pathOr,  propOr } from 'ramda'
import IconTeam from "../../icons/IconTeam.vue";
import IconRemove from "../../icons/IconRemove.vue";
import IconMenu from "../../icons/IconMenu.vue";

export default {
  name: 'team',

  components: {
    IconMenu,
    IconRemove,
    IconTeam,
    Avatar,
  },

  props: {
    item: {
      type: Object,
      default: function() {
        return {
          team: {
            name: ''
          },
          memberCount: 0
        }
      }
    },
    hasAdminRights: {
      type: Boolean,
      default: false
    },
    removeFromList: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization'
    ]),

    teamName: function() {
      return pathOr('', ['team', 'name'], this.item)
    },
    systemTeamType: function() {
      const value = this.item.team.systemTeamType || ''
      return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
    },
    memberCount: function() {
      const count = propOr(0, 'memberCount', this.item)
      const plural = count === 1 ? '' : 's'
      return `${count} Member${plural}`
    }
  },

  methods: {
    /**
     * Dynamically creates team members id for team-members-list route
     * @param {Object} team
     * @returns {String}
     */
    createTeamId: function(team) {
      const teamId = pathOr('N:team:0', ['team', 'id'], team)
      return teamId
    },
    /**
     * Dynamically changes route and saves team in $store.view state
     * @param {Object} team
     */
    changeRoute: function(team) {
      const id = this.createTeamId(team)
      this.$router.push({
        name: 'team-members-list',
        params: {
          id
        }
      })
    },
    /**
     * Open delete team dialog
     * @param {Object} team
     */
    openDeleteDialog: function(team) {
      if (this.removeFromList) {
        return this.$emit('remove-team-from-list', team)
      }
      EventBus.$emit('open-remove-team', team)
    },
    /**
     * Handler for team menu click
     * @param {String} name
     */
    onTeamMenu: function(name) {
      if (typeof this[name] === 'function') {
        this[name](this.item)
      }
    },
  }
}

</script>

<style scoped lang="scss">
@import '../../../assets/variables';

.team {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;

  a {
    cursor: pointer;
  }

  .name {
    color: #000;
    font-weight: 600
  }
}

.team-col {
  display: flex;
  align-items: center;
}

.team-info {
  display: flex;
  align-items: center;
}

.team-avatar {
  margin-right: 16px;
}
</style>