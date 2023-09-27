<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        title="People"
        class="primary"
      >
        <template #description>
          <p>
            Members of your organization will be able to create datasets, add data to their datasets, and
            share datasets with other members of the team.
          </p>
        </template>
      </bf-rafter>
    </template>

    <template #stage>
      <router-view name="stage" />
    </template>

  </bf-page>

</template>

<script>
export default {
  name: 'BfPeople'


}
</script>
