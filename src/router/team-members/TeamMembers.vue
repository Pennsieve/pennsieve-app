<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Team Members"
      class="primary"
    >
      <template #breadcrumb>
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
    </bf-rafter>
    <router-view
      name="stage"
    />
  </bf-page>
</template>

<script>
export default {
  name: 'BfTeamMembers'
}
</script>
