<template>
  <div>
    <el-row
      class="team-member"
      type="flex"
      :gutter="32"
      align="middle"
    >
      <el-col
        :sm="17"
        class="team-col info"
      >
        <user :user="item" />
      </el-col>
      <el-col
        :sm="7"
        class="align-right"
      >
        <button
          v-if="hasAdminRights || removeFromList"
          class="tools"
          @click="openDeleteMember(item)"
        >
          <IconRemove
            :height="10"
            :width="10"
            />

        </button>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import User from '../../shared/user/User.vue'
import UserRoles from '../../../mixins/user-roles'
import EventBus from '../../../utils/event-bus'
import { propOr } from 'ramda'
import IconRemove from "../../icons/IconRemove.vue";

export default {
  name: 'TeamMember',

  components: {
    IconRemove,
    User
  },

  mixins: [
    UserRoles
  ],

  props: {
    item: {
      type: Object,
    },
    removeFromList: {
      type: Boolean,
      default: false
    },
  },

  computed: {
    ...mapGetters([
      'activeOrganization'
    ]),
    hasAdminRights: function() {
      const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
      const isOwner = propOr(false, 'isOwner', this.activeOrganization)
      return isAdmin || isOwner
    },
  },

  methods: {
    /**
     * Removes an org member from either a list or from the team
     * List is used when adding new team members.
     */
    openDeleteMember: function(member) {
      if (this.removeFromList) {
        return this.$emit('remove-member-from-list', member)
      }
      this.$emit('open-remove-collaborator', member)
      // EventBus.$emit('open-remove-collaborator', member)
    }
  }
}
</script>

<style lang="scss">
@import '../../../assets/variables';

.team-member {
  padding: 8px 0
}
</style>
