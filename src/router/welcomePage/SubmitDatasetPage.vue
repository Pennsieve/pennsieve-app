<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        slot="heading"
        title="My Dataset Publication Requests"
        class="primary"
      >
        <template #description>
          <p> Here, you can request to submit a dataset for a specific repository. The repository will review your request and either accept or reject your request based on the scope of the repository and your justfication for requesting to publish in the selected repository. If your request is rejected, you can request the dataset to be published in a different repository.</p>
        </template>

      </bf-rafter>
      <router-view
        name="stage"
        :datasetProposals="datasetProposals"/>
    </template>
  </bf-page>

</template>

<script>
import {mapActions, mapState} from "vuex";

export default {
  name: "SubmitDatasetPage",
  computed: {
    ...mapState('repositoryModule', [
      'datasetProposals'
    ]),
  },
  mounted () {
    this.fetchRepositories()
    this.fetchProposals()
  },

  methods: {
    ...mapActions('repositoryModule', ['fetchRepositories','fetchProposals']),
  }

}
</script>