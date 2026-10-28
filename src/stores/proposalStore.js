import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useGetToken } from '@/composables/useGetToken.js'
import * as siteConfig from '@/site-config/site.json'

export const useProposalStore = defineStore('proposalStore', () => {

  // State
  const repositories = ref([])
  const datasetProposals = ref([])
  const requestModalVisible = ref(false)
  const shouldCollapsePrimaryNav = ref(false)
  const selectedRepoForRequest = ref({})
  const selectedDatasetProposal = ref({})

  // Loading and error states
  const isLoadingRepositories = ref(false)
  const isLoadingProposals = ref(false)
  const repositoriesError = ref('')
  const proposalsError = ref('')

  // Computed
  const hasProposals = computed(() => datasetProposals.value.length > 0)

  // Helper functions
  const sortRepositories = (repos) => {
    return repos.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'en', { numeric: true })
    )
  }

  // contributors is deprecated on the backend; drop it so it never gets sent back
  const transformProposalIn = (proposal) => {
    const { contributors, ...proposalFields } = proposal
    return proposalFields
  }

  // Only send what the API reads. ownerName, emailAddress, status and timestamps
  // are set by the backend; sending them back is at best ignored.
  const toProposalRequestBody = (proposal, profile) => ({
    // PUT looks the proposal up by nodeId and the userId in the body, so send
    // back the userId it came with
    ...(proposal.nodeId && {
      nodeId: proposal.nodeId,
      userId: proposal.userId ?? profile?.intId,
    }),
    name: proposal.name,
    description: proposal.description,
    organizationNodeId: proposal.organizationNodeId,
    survey: proposal.survey,
  })

  // Calls the publishing service and returns the parsed JSON body (null when
  // there is none). Error responses have an empty body, so the thrown error
  // carries the status code for utils/proposalErrorMessages.js.
  const requestPublishingApi = async (path, { method = 'GET', body } = {}) => {
    const token = await useGetToken()
    const headers = new Headers()
    headers.append('Authorization', 'Bearer ' + token)
    headers.append('Accept', 'application/json')
    if (body !== undefined) {
      headers.append('Content-Type', 'application/json')
    }

    const response = await fetch(`${siteConfig.api2Url}/publishing${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
      const requestError = new Error(`${response.status} ${response.statusText}`)
      requestError.status = response.status
      throw requestError
    }

    const responseText = await response.text()
    return responseText ? JSON.parse(responseText) : null
  }

  const replaceProposalInList = (updatedProposal) => {
    const index = datasetProposals.value.findIndex(p => p.nodeId === updatedProposal.nodeId)
    if (index > -1) {
      datasetProposals.value[index] = updatedProposal
    }
  }

  // Shared by submit, withdraw, accept and reject: each returns the proposal
  // with its new status
  const changeProposalStatus = async (path, proposal, actionLabel) => {
    try {
      const responseJson = await requestPublishingApi(
        `${path}?node_id=${proposal.nodeId}`,
        { method: 'POST' }
      )
      const changedProposal = transformProposalIn(responseJson)
      replaceProposalInList(changedProposal)
      return {
        status: 'SUCCESS',
        result: changedProposal
      }
    } catch (err) {
      console.error(`Failed to ${actionLabel} proposal:`, err)
      throw err
    }
  }

  // Actions

  // Fetch all repositories
  const fetchRepositories = async () => {
    isLoadingRepositories.value = true
    repositoriesError.value = ''

    try {
      // The Go backend encodes an empty list as null
      const responseJson = (await requestPublishingApi('/repositories')) ?? []
      let count = 0
      const processedRepositories = responseJson.map(r => ({
        id: ++count,
        isPublic: r.type === "PUBLIC",
        ...r
      }))
      repositories.value = sortRepositories(processedRepositories)
    } catch (err) {
      console.error('Failed to fetch repositories:', err)
      repositoriesError.value = 'Failed to load repositories'
      repositories.value = []
    } finally {
      isLoadingRepositories.value = false
    }
  }

  // Fetch user's proposals
  const fetchProposals = async () => {
    isLoadingProposals.value = true
    proposalsError.value = ''

    try {
      // The Go backend encodes an empty list as null (user has no proposals yet)
      const responseJson = (await requestPublishingApi('/proposal')) ?? []
      datasetProposals.value = responseJson.map(transformProposalIn)
    } catch (err) {
      console.error('Failed to fetch proposals:', err)
      proposalsError.value = 'Failed to load proposals'
      datasetProposals.value = []
    } finally {
      isLoadingProposals.value = false
    }
  }

  // Store new proposal (creates as DRAFT)
  const storeNewProposal = async (proposal, profile) => {
    try {
      const responseJson = await requestPublishingApi('/proposal', {
        method: 'POST',
        body: toProposalRequestBody(proposal, profile)
      })
      const newProposal = transformProposalIn(responseJson)
      datasetProposals.value.push(newProposal)
      return {
        status: "SUCCESS",
        result: newProposal
      }
    } catch (err) {
      console.error('Failed to create proposal:', err)
      throw err
    }
  }

  // Update existing proposal (PUT API)
  const updateProposal = async (proposal, profile) => {
    try {
      const responseJson = await requestPublishingApi('/proposal', {
        method: 'PUT',
        body: toProposalRequestBody(proposal, profile)
      })
      const updatedProposal = transformProposalIn(responseJson)
      replaceProposalInList(updatedProposal)
      return {
        status: "SUCCESS",
        result: updatedProposal
      }
    } catch (err) {
      console.error('Failed to update proposal:', err)
      throw err
    }
  }

  // Remove proposal
  const removeProposal = async (proposal) => {
    try {
      // Note: DELETE uses proposal_node_id, the status routes use node_id
      await requestPublishingApi(`/proposal?proposal_node_id=${proposal.nodeId}`, {
        method: 'DELETE'
      })
      datasetProposals.value = datasetProposals.value.filter(p => p.nodeId !== proposal.nodeId)
      return {
        status: "SUCCESS"
      }
    } catch (err) {
      console.error('Failed to delete proposal:', err)
      throw err
    }
  }

  // Submit proposal (changes status from DRAFT to SUBMITTED)
  const submitProposal = (proposal) =>
    changeProposalStatus('/proposal/submit', proposal, 'submit')

  // Withdraw submitted proposal
  const withdrawProposal = (proposal) =>
    changeProposalStatus('/proposal/withdraw', proposal, 'withdraw')

  // Accept proposal (for repository publishers)
  const acceptProposal = (proposal) =>
    changeProposalStatus('/submission/accept', proposal, 'accept')

  // Reject proposal (for repository publishers)
  const rejectProposal = (proposal) =>
    changeProposalStatus('/submission/reject', proposal, 'reject')

  // Getters as computed functions
  const getRepositoryByNodeId = computed(() => (nodeId) => {
    return repositories.value.find(repo => repo.organizationNodeId === nodeId) || {}
  })

  // Modal and UI state actions
  const updateRequestModalVisible = (isModalVisible) => {
    requestModalVisible.value = isModalVisible
  }

  const setSelectedRepo = (repo) => {
    selectedRepoForRequest.value = repo || {}
  }

  const setSelectedProposal = (proposal) => {
    selectedDatasetProposal.value = proposal || {}
  }

  return {
    // State
    repositories,
    datasetProposals,
    requestModalVisible,
    shouldCollapsePrimaryNav,
    selectedRepoForRequest,
    selectedDatasetProposal,
    isLoadingRepositories,
    isLoadingProposals,
    repositoriesError,
    proposalsError,

    // Computed
    hasProposals,
    getRepositoryByNodeId,

    // Actions
    fetchRepositories,
    fetchProposals,
    storeNewProposal,
    updateProposal,
    removeProposal,
    submitProposal,
    withdrawProposal,
    acceptProposal,
    rejectProposal,
    updateRequestModalVisible,
    setSelectedRepo,
    setSelectedProposal
  }
})
