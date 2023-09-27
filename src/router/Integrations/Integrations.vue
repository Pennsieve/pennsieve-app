<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Integrations"
      class="primary"
    >
      <template #description>
        <div
          slot="description"
          class="description"
        >

          <p v-if="this.$route.name === 'applications'">
            Applications support actions on various entities on the platform such as "Files", "Records", and "Datasets".
            Registered applications can be triggered from the action-menu associated with the targeted entities.
            <a
              href="https://docs.pennsieve.io/docs/introduction-to-integrations"
              target="_blank"
            >
              What's this?
            </a>
          </p>
          <p v-else>
            Webhooks provide mechanisms to notify external applications of events that happen on the Pennsieve platform, such as "File Uploaded", or "Description updated".
            <a
              href="https://docs.pennsieve.io/docs/preventing-files-from-being-included-during-publishing"
              target="_blank"
            >
              What's this?
            </a>
          </p>
        </div>
      </template>
      <template #tabs>
        <ul
          class="tabs unstyled"
        >
          <li
            key="ApplicationsList"
          >
            <router-link to="applications">
              Applications
            </router-link>
          </li>
          <li
            key="IntegrationsList"
          >
            <router-link to="webhooks">
              Webhooks
            </router-link>
          </li>
        </ul>
      </template>

    </bf-rafter>
    <router-view
      name="stage"
      :integrations="integrations"
    />
  </bf-page>
</template>

<script>
  import {mapState} from "vuex";
  import BfPage from '../../components/layout/BfPage/BfPage.vue'
  import BfStage from '../../components/layout/BfStage/BfStage.vue'
  import BfRafter from '../../components/shared/bf-rafter/BfRafter.vue'


  export default {
    name: 'IntegrationView',
    components: {
      BfPage,
      BfStage,
      BfRafter
    },
    computed: {
      ...mapState('integrationsModule', [
        'integrations'
      ]),
    }
  }
</script>


<style scoped lang="scss">
@import '../../assets/variables';


.description {
  max-width: 600px;
}
</style>

