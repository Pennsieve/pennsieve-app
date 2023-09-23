<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        slot="heading"
        title="Teams"
        class="primary"
      >
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
export default {
  name: 'BfTeams'
}
</script>
