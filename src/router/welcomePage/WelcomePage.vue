<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Submit Datsaet Proposals"
      class="primary"
    >
      <template #description>
        <p> Submit and track any dataset proposals.</p>

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
import BfRafter from "@/components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "@/components/shared/routerTabs/routerTabs.vue";

export default {
  name: "WelcomePage",
  components: {RouterTabs, BfRafter},
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
          name: "My Dataset Submissions",
          to: "submit"
        },
        {
          name: "Open Repositories",
          to: "welcome"
        },

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