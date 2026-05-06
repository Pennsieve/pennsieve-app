import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import * as siteConfig from '@/site-config/site.json'

const GITHUB_PROFILE_URL = `${siteConfig.api2Url}/accounts/github/user`
const GITHUB_REGISTER_URL = `${siteConfig.api2Url}/accounts/github/register`

/**
 * Encapsulates the GitHub OAuth popup flow:
 *   1. opens the Pennsieve GitHub App popup
 *   2. listens for the postMessage from /github-redirect
 *   3. if an OAuth `code` is present (fresh authorization), POSTs code +
 *      installation_id to /accounts/github/register
 *      if only `installation_id` is present (the user merely updated which
 *      repos the app can access, no new OAuth token), re-fetches the
 *      profile via GET /accounts/github/user instead
 *   4. optionally refreshes the tracked repositories list so the user
 *      sees the repos they just added/removed on GitHub
 *   5. writes the updated profile back into the Vuex profile
 *
 * Must be called from setup() so it can register lifecycle hooks.
 *
 * @param {Object} [options]
 * @param {string} [options.successMessage]
 * @param {string} [options.errorMessage]
 * @param {boolean} [options.refreshRepos] when true, dispatches
 *   codeReposModule/fetchMyRepos after any successful OAuth message so
 *   the repo list reflects GitHub-side changes
 * @param {(profile: Object) => void} [options.onSuccess]
 */
export function useGithubOAuth(options = {}) {
  const {
    successMessage = 'Your GitHub account has been successfully added!',
    errorMessage = 'Failed to connect GitHub account. Please try again.',
    refreshRepos = false,
    onSuccess,
  } = options

  const store = useStore()
  const instance = getCurrentInstance()
  const oauthWindow = ref(null)
  const profile = computed(() => store.state.profile)

  function openGithubOAuth() {
    const redirectUri = `${window.location.origin}/github-redirect`
    const url = `${siteConfig.githubAppUrl}?redirect_uri=${redirectUri}`
    oauthWindow.value = window.open(
      url,
      '_blank',
      'toolbar=no, scrollbars=yes, width=600, height=800, top=200, left=500'
    )
  }

  function showMessage(message, type, duration) {
    instance?.proxy?.$message?.({
      message,
      type,
      center: true,
      duration,
      showClose: true,
    })
  }

  async function refreshRepositories() {
    if (!refreshRepos) return
    const params = store.state.codeReposModule?.myReposPaginationParams
    try {
      await store.dispatch('codeReposModule/fetchMyRepos', {
        page: params?.currentPage ?? 1,
        size: params?.size ?? 25,
      })
    } catch (err) {
      console.error('Failed to refresh repositories after OAuth update:', err)
    }
  }

  async function registerWithCode(code, installationId) {
    const token = await useGetToken()
    const response = await useSendXhr(GITHUB_REGISTER_URL, {
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        code,
        installation_id: installationId,
      },
    })

    await store.dispatch('updateProfile', {
      ...profile.value,
      githubProfile: response,
    })

    return response
  }

  const messageEventListener = async (event) => {
    if (
      !event.data ||
      event.data.source !== 'github-redirect-response'
    ) {
      return
    }

    // GitHub's redirect can come back in two shapes:
    //   - fresh authorization: has `code` (+ installation_id)
    //   - installation update only (add/remove repos): has installation_id, no code
    // Ignore the message only if we have neither.
    if (!event.data.code && !event.data.installationId) {
      return
    }

    try {
      let githubProfile
      if (event.data.code) {
        githubProfile = await registerWithCode(
          event.data.code,
          event.data.installationId
        )
      } else {
        // installation-update case: no new OAuth token, just re-sync profile
        githubProfile = await fetchGithubProfile()
      }

      await refreshRepositories()

      showMessage(successMessage, 'success', 3000)

      if (onSuccess && githubProfile) onSuccess(githubProfile)
    } catch (err) {
      console.error('GitHub OAuth callback error:', err)
      showMessage(errorMessage, 'error', 5000)
    }
  }

  async function fetchGithubProfile() {
    try {
      const token = await useGetToken()
      const response = await fetch(GITHUB_PROFILE_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: '*/*',
        },
      })

      if (!response.ok) {
        console.error(
          'GitHub API response not ok:',
          response.status,
          response.statusText
        )
        return null
      }

      const data = await response.json()
      if (data?.login) {
        await store.dispatch('updateProfile', {
          ...profile.value,
          githubProfile: data,
        })
        return data
      }
      return null
    } catch (err) {
      console.error('Failed to fetch GitHub profile:', err)
      return null
    }
  }

  onMounted(() => {
    window.addEventListener('message', messageEventListener)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', messageEventListener)
  })

  return {
    openGithubOAuth,
    fetchGithubProfile,
    refreshRepositories,
    oauthWindow,
  }
}
