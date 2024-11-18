<template>
  <div>
    <div
      v-loading.fullscreen.lock="loading"
    />
  </div>
</template>

<script>

export default {
  name: 'GitHubRedirect',
  data() {
    return {
      loading: true
    }
  },

  /**
   * The logic in this mounted function retrieves the
   * orcid code that is inserted in redirect url
   * and uses postMessage to send that code to
   * the parent window that had originally launched
   * this redirect window
   */
  mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const installationId = urlParams.get('installation_id')
    const parentWindow = window.opener
    parentWindow.postMessage({ source: 'github-redirect-response', code: code, installationId: installationId }, '*',)
    window.close()
  },
}
</script>

<style scoped>

</style>
