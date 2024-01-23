<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="User Dashboard"
      class="primary"
    >
      <template #description>
        <p> Manage your user-profile, developer tools as well as submit and track any dataset proposals and public datasets.</p>

      </template>

      <template #tabs>
        <router-tabs :tabs="tabs"/>
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

  data() {
    return {
      tabs: [
        {
          name: "My Profile",
          to: "my-settings-container"
        },
        {
          name: "My Dataset Submissions",
          to: "submit"
        },
        {
          name: "My Public Datasets",
          to: "submit"
        },
        {
          name: "Developer Tools",
          to: "submit"
        }
      ]
    }
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