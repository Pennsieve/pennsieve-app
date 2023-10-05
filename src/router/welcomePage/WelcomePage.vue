<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Welcome to Pennsieve"
      class="primary"
    >
      <template #description>
        <p> Pennsieve is a cloud-based data management and publication platform which supports several public repositories as well as private consortium workspaces.</p>

      </template>
    </bf-rafter>
    <router-view
      name="stage"
      :repositories="repositories"/>
  </bf-page>

</template>

<script>
import {mapActions, mapState} from "vuex";

export default {
  name: "WelcomePage",
  props: {
    orgId: {
      type: String,
      default: ''
    }
  },

  computed: {
    ...mapState('repositoryModule', [
      'repositories',
      'requestModalVisible'

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