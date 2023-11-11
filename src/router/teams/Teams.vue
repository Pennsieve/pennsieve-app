<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        slot="heading"
        title="Teams"
        class="primary"
        :org-id="orgId"
      >
        <template #breadcrumb v-if="this.$route.name === 'team-members-list'">
          <div>
            <router-link :to="{ name: 'teams-list' }">
              <IconArrowLeft
                class="icon"
                :width="10"
                :height="10"
              />
              All Teams
            </router-link>
          </div>

        </template>
        <template #description>
          <p>
            You can create teams to group users. Datasets can be shared with individual users, or teams.
          </p>
        </template>
      </bf-rafter>
      <router-view name="stage" />
    </template>
  </bf-page>
</template>

<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";

export default {
  name: 'BfTeams',
  components: {
    BfRafter
  },
  // From Router
  props: {
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    }
  },

  computed: {
  }
}
</script>
