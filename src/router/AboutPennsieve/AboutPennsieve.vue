<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="About Pennsieve"
      class="primary"
    >
<!--      <template #description>-->
<!--        <p> Pennsieve is a cloud-based data management and publication platform which supports several public repositories as well as private consortium workspaces.</p>-->

<!--      </template>-->

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
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";

export default {
  name: "AboutPennsieve",
  props: {
    orgId: {
      type: String,
      default: ''
    }
  },

  components:[
    BfRafter
  ],

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
          name: "Our Team and Funding",
          to: "info"
        },
        {
          name: "Open Repositories",
          to: "welcome"
        },
        {
          name: "Getting Help",
          to: "support"
        },
        {
          name: "Developer Tools",
          to: "developer-tools"
        },


      ]
    }
  },
  mounted () {
    this.fetchRepositories()
  },

  methods: {
    ...mapActions('repositoryModule', ['fetchRepositories','fetchProposals']),
  }
}
</script>