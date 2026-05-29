<template>
  <bf-page v-if="featureEnabled" id="page">
    <template #stage>
      <WorkspaceOverview :org-id="orgId" />
    </template>
  </bf-page>
</template>

<script>
import { mapGetters } from 'vuex'
import BfPage from '@/components/layout/BfPage/BfPage.vue'
import WorkspaceOverview from '@/components/WorkspaceOverview/WorkspaceOverview.vue'

export default {
  name: 'WorkspaceOverviewView',
  components: { BfPage, WorkspaceOverview },
  props: {
    orgId: { type: String, default: '' },
  },
  computed: {
    ...mapGetters(['activeOrganization', 'hasFeature']),
    // The Insights page is chat-centric — when the org hasn't enabled
    // `compute_node_chat`, the page has nothing useful to render. Use a
    // computed flag (not a watcher) so the redirect path runs as soon as
    // the org loads, and we don't briefly flash the empty page.
    featureEnabled() {
      return this.hasFeature('compute_node_chat')
    },
  },
  watch: {
    // Redirect away when the org loads and the feature is off. Watch
    // activeOrganization rather than featureEnabled directly because
    // hasFeature returns false both for "no org loaded yet" and "org
    // loaded, feature absent" — without the activeOrganization gate
    // we'd redirect during the brief pre-load window. Once the org is
    // present, hasFeature's result is authoritative.
    activeOrganization: {
      immediate: true,
      handler(org) {
        if (org?.organization?.id && !this.featureEnabled) {
          this.$router.replace({
            name: 'datasets-list',
            params: { orgId: this.orgId || org.organization.id },
          })
        }
      },
    },
  },
}
</script>
