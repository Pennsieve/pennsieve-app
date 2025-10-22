import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useGetToken } from '@/composables/useGetToken.js'
import * as siteConfig from '@/site-config/site.json'

export const useProposalStore = defineStore('proposalStore', () => {

  // State
  const publishingInfo = ref([])
  const repositories = ref([])
  const datasetProposals = ref([])
  const repositoryModalVisible = ref(false)
  const requestModalVisible = ref(false)
  const shouldCollapsePrimaryNav = ref(false)
  const repositoryDescription = ref('**This is a sample repository**')
  const isLoadingRepositoryDescription = ref(false)
  const selectedRepoForRequest = ref({})
  const selectedDatasetProposal = ref({})
  
  // Loading and error states
  const isLoadingRepositories = ref(false)
  const isLoadingProposals = ref(false)
  const repositoriesError = ref('')
  const proposalsError = ref('')
  
  // Computed
  const hasProposals = computed(() => datasetProposals.value.length > 0)
  const hasRepositories = computed(() => repositories.value.length > 0)
  
  const publicRepositories = computed(() => 
    repositories.value.filter(repo => repo.isPublic)
  )
  
  const sortedRepositories = computed(() => 
    [...repositories.value].sort((a, b) => 
      a.displayName.localeCompare(b.displayName, 'en', { numeric: true })
    )
  )

  // Helper functions
  const sortRepositories = (repos) => {
    return repos.sort((a, b) => 
      a.displayName.localeCompare(b.displayName, 'en', { numeric: true })
    )
  }

  const getOwnerName = (profile) => {
    const firstName = profile?.firstName || ''
    const lastName = profile?.lastName || ''
    return `${firstName} ${lastName}`.trim()
  }

  const transformProposalIn = (proposal, count = 0) => {
    return {
      id: count,
      ...proposal
    }
  }

  const transformProposalOut = (proposal, profile) => {
    return {
      userId: profile?.intId,
      ownerName: getOwnerName(profile),
      ...proposal
    }
  }

  // Clear store state
  const clearProposalStore = () => {
    publishingInfo.value = []
    repositories.value = []
    datasetProposals.value = []
    repositoryModalVisible.value = false
    requestModalVisible.value = false
    shouldCollapsePrimaryNav.value = false
    repositoryDescription.value = '**This is a sample repository**'
    isLoadingRepositoryDescription.value = false
    selectedRepoForRequest.value = {}
    selectedDatasetProposal.value = {}
    isLoadingRepositories.value = false
    isLoadingProposals.value = false
    repositoriesError.value = ''
    proposalsError.value = ''
  }

  // Actions

  // Fetch publishing info
  const fetchPublishingInfo = async () => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/info`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        let count = 0
        publishingInfo.value = responseJson.map(r => ({
          id: ++count,
          ...r
        }))
      } else {
        publishingInfo.value = []
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to fetch publishing info:', err)
      publishingInfo.value = []
    }
  }

  // Fetch all repositories
  const fetchRepositories = async () => {
    isLoadingRepositories.value = true
    repositoriesError.value = ''
    
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/repositories`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        let count = 0
        const processedRepositories = responseJson.map(r => ({
          id: ++count,
          isPublic: r.type === "PUBLIC",
          ...r
        }))
        repositories.value = sortRepositories(processedRepositories)
      } else {
        repositories.value = []
        throw new Error(response.statusText)
      }
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
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        let count = 0
        datasetProposals.value = responseJson.map(p => 
          transformProposalIn(p, ++count)
        )
      } else {
        datasetProposals.value = []
        throw new Error(response.statusText)
      }
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
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      myHeaders.append('Content-Type', 'application/json')
      
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(transformProposalOut(proposal, profile))
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const count = datasetProposals.value.length
        const newProposal = transformProposalIn(responseJson, count + 1)
        datasetProposals.value.push(newProposal)
        return {
          status: "SUCCESS",
          result: newProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to create proposal:', err)
      throw err
    }
  }

  // Update existing proposal
  const storeChangedProposal = async (proposal, profile) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      myHeaders.append('Content-Type', 'application/json')
      
      const response = await fetch(url, {
        method: "PUT",
        headers: myHeaders,
        body: JSON.stringify(transformProposalOut(proposal, profile))
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const updatedProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          updatedProposal.id = existing.id
          datasetProposals.value[index] = updatedProposal
        }
        
        return {
          status: "SUCCESS",
          result: updatedProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to update proposal:', err)
      throw err
    }
  }

  // Remove proposal
  const removeProposal = async (proposal) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal?proposal_node_id=${proposal.nodeId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, {
        method: "DELETE",
        headers: myHeaders
      })
      
      if (response.ok) {
        // Remove from local state
        datasetProposals.value = datasetProposals.value.filter(p => p.nodeId !== proposal.nodeId)
        return {
          status: "SUCCESS"
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to delete proposal:', err)
      throw err
    }
  }

  // Update existing proposal (PUT API)
  const updateProposal = async (proposal, profile) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      myHeaders.append('Content-Type', 'application/json')
      
      const response = await fetch(url, {
        method: "PUT",
        headers: myHeaders,
        body: JSON.stringify(transformProposalOut(proposal, profile))
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const updatedProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId || p.id === proposal.id)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          updatedProposal.id = existing.id
          datasetProposals.value[index] = updatedProposal
        }
        
        return {
          status: "SUCCESS",
          result: updatedProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to update proposal:', err)
      throw err
    }
  }

  // Submit proposal (changes status from DRAFT to SUBMITTED)
  const submitProposal = async (proposal) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal/submit?node_id=${proposal.nodeId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const submittedProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          submittedProposal.id = existing.id
          datasetProposals.value[index] = submittedProposal
        }
        
        return {
          status: "SUCCESS",
          result: submittedProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to submit proposal:', err)
      throw err
    }
  }

  // Withdraw submitted proposal
  const withdrawProposal = async (proposal) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/proposal/withdraw?node_id=${proposal.nodeId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const withdrawnProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          withdrawnProposal.id = existing.id
          datasetProposals.value[index] = withdrawnProposal
        }
        
        return {
          status: "SUCCESS",
          result: withdrawnProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to withdraw proposal:', err)
      throw err
    }
  }

  // Accept proposal (for repository owners)
  const acceptProposal = async (proposal) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/submission/accept?node_id=${proposal.nodeId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const acceptedProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          acceptedProposal.id = existing.id
          datasetProposals.value[index] = acceptedProposal
        }
        
        return {
          status: "SUCCESS",
          result: acceptedProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to accept proposal:', err)
      throw err
    }
  }

  // Reject proposal (for repository owners)
  const rejectProposal = async (proposal) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/publishing/submission/reject?node_id=${proposal.nodeId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        const rejectedProposal = transformProposalIn(responseJson)
        
        // Update the proposal in the list
        const index = datasetProposals.value.findIndex(p => p.nodeId === proposal.nodeId)
        if (index > -1) {
          const existing = datasetProposals.value[index]
          rejectedProposal.id = existing.id
          datasetProposals.value[index] = rejectedProposal
        }
        
        return {
          status: "SUCCESS",
          result: rejectedProposal
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      console.error('Failed to reject proposal:', err)
      throw err
    }
  }

  // Getters as computed functions
  const getPublishingInfo = computed(() => (tag) => {
    return publishingInfo.value.find(info => info.tag === tag) || {}
  })

  const getRepositoryByNodeId = computed(() => (nodeId) => {
    return repositories.value.find(repo => repo.organizationNodeId === nodeId) || {}
  })

  const getProposalByNodeId = computed(() => (nodeId) => {
    return datasetProposals.value.find(proposal => proposal.nodeId === nodeId) || {}
  })

  // Modal and UI state actions
  const updateModalVisible = (isModalVisible) => {
    repositoryModalVisible.value = isModalVisible
  }

  const updateRequestModalVisible = (isModalVisible) => {
    requestModalVisible.value = isModalVisible
  }

  const setIsLoadingRepositoryDescription = (isLoading) => {
    isLoadingRepositoryDescription.value = isLoading || false
  }

  const setRepositoryDescription = (description) => {
    repositoryDescription.value = description
  }

  const setSelectedRepo = (repo) => {
    selectedRepoForRequest.value = repo || {}
  }

  const clearSelectedRepo = () => {
    selectedRepoForRequest.value = {}
  }

  const setSelectedProposal = (proposal) => {
    selectedDatasetProposal.value = proposal || {}
  }

  const updateProposals = (proposals) => {
    datasetProposals.value = proposals
  }

  const updateRepositories = (repos) => {
    repositories.value = sortRepositories(repos)
  }

  const updatePublishingInfo = (info) => {
    publishingInfo.value = info
  }

  return {
    // State
    publishingInfo,
    repositories,
    datasetProposals,
    repositoryModalVisible,
    requestModalVisible,
    shouldCollapsePrimaryNav,
    repositoryDescription,
    isLoadingRepositoryDescription,
    selectedRepoForRequest,
    selectedDatasetProposal,
    isLoadingRepositories,
    isLoadingProposals,
    repositoriesError,
    proposalsError,
    
    // Computed
    hasProposals,
    hasRepositories,
    publicRepositories,
    sortedRepositories,
    getPublishingInfo,
    getRepositoryByNodeId,
    getProposalByNodeId,
    
    // Actions
    clearProposalStore,
    fetchPublishingInfo,
    fetchRepositories,
    fetchProposals,
    storeNewProposal,
    storeChangedProposal,
    updateProposal,
    removeProposal,
    submitProposal,
    withdrawProposal,
    acceptProposal,
    rejectProposal,
    updateModalVisible,
    updateRequestModalVisible,
    setIsLoadingRepositoryDescription,
    setRepositoryDescription,
    setSelectedRepo,
    clearSelectedRepo,
    setSelectedProposal,
    updateProposals,
    updateRepositories,
    updatePublishingInfo
  }
})