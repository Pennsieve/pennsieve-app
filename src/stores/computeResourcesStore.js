// @/stores/computeResourcesStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

export const useComputeResourcesStore = defineStore('computeResources', () => {
  // Scoped compute nodes cache - tracks different contexts
  const scopedComputeNodes = ref(new Map()) // Key: scope (e.g., 'account-owner', 'workspace:orgId')
  const scopedNodesLastFetched = ref(new Map()) // Track fetch times per scope
  const scopedNodesLoading = ref(new Map()) // Track loading states per scope
  
  // Compute Accounts State (for future use)
  const computeAccounts = ref([])
  const computeAccountsLoaded = ref(false)
  const isLoadingComputeAccounts = ref(false)
  const computeAccountsLastFetched = ref(null)
  
  // Permissions cache - keyed by nodeId
  const nodePermissions = ref({})
  const permissionsLoaded = ref({})
  const isLoadingPermissions = ref({})
  
  // Update states - keyed by nodeId
  const updateStates = ref({})

  // Secrets cache - keyed by nodeId
  const nodeSecrets = ref({})         // { [nodeId]: { key: value, ... } }
  const nodeSharedSecrets = ref({})   // { [nodeId]: { key: value, ... } }
  const secretsLoaded = ref({})       // { [nodeId]: boolean }
  const sharedSecretsLoaded = ref({}) // { [nodeId]: boolean }
  const isLoadingSecrets = ref({})
  const isLoadingSharedSecrets = ref({})

  // Allowed processors cache - keyed by nodeId
  const nodeAllowedProcessors = ref({})       // { [nodeId]: string[] }
  const allowedProcessorsLoaded = ref({})     // { [nodeId]: boolean }
  const isLoadingAllowedProcessors = ref({})

  // Layers cache - keyed by nodeId
  const nodeLayers = ref({})                  // { [nodeId]: { layers: [], totalSizeGB, totalEstimatedMonthlyCostUsd } }
  const layersLoaded = ref({})                // { [nodeId]: boolean }
  const isLoadingLayers = ref({})

  // Cache timeout (5 minutes)
  const CACHE_TIMEOUT = 5 * 60 * 1000

  // Getters
  const getComputeNodeById = computed(() => (nodeId, scope = 'account-owner') => {
    const nodes = scopedComputeNodes.value.get(scope) || []
    return nodes.find(node => node.uuid === nodeId)
  })

  const getNodePermissions = computed(() => (nodeId) => {
    return nodePermissions.value[nodeId] || {}
  })

  const isNodeUpdating = computed(() => (nodeId) => {
    return updateStates.value[nodeId] || false
  })

  const getNodeSecrets = computed(() => (nodeId) => {
    return nodeSecrets.value[nodeId] || []
  })

  const getNodeSharedSecrets = computed(() => (nodeId) => {
    return nodeSharedSecrets.value[nodeId] || []
  })

  const isNodeSecretsLoading = computed(() => (nodeId) => {
    return isLoadingSecrets.value[nodeId] || false
  })

  const isNodeSharedSecretsLoading = computed(() => (nodeId) => {
    return isLoadingSharedSecrets.value[nodeId] || false
  })

  const isNodePermissionsLoading = computed(() => (nodeId) => {
    return isLoadingPermissions.value[nodeId] || false
  })

  const getNodeAllowedProcessors = computed(() => (nodeId) => {
    return nodeAllowedProcessors.value[nodeId] || []
  })

  const isNodeAllowedProcessorsLoading = computed(() => (nodeId) => {
    return isLoadingAllowedProcessors.value[nodeId] || false
  })

  const getNodeLayers = computed(() => (nodeId) => {
    return nodeLayers.value[nodeId] || { layers: [], totalSizeGB: 0, totalEstimatedMonthlyCostUsd: 0 }
  })

  const isNodeLayersLoading = computed(() => (nodeId) => {
    return isLoadingLayers.value[nodeId] || false
  })

  const isComputeAccountsCacheValid = computed(() => {
    if (!computeAccountsLastFetched.value) return false
    return (Date.now() - computeAccountsLastFetched.value) < CACHE_TIMEOUT
  })

  const getComputeNodesForAccount = computed(() => (accountId, scope = 'account-owner') => {
    const nodes = scopedComputeNodes.value.get(scope) || []
    const filteredNodes = nodes.filter(node => node.account?.accountId === accountId)
    // Maintain sort order by name
    return filteredNodes.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  })

  // Getter for scoped compute nodes
  const getScopedComputeNodes = computed(() => (scope) => {
    return scopedComputeNodes.value.get(scope) || []
  })

  // Check if scoped cache is valid
  const isScopedCacheValid = computed(() => (scope) => {
    const lastFetched = scopedNodesLastFetched.value.get(scope)
    if (!lastFetched) return false
    return (Date.now() - lastFetched) < CACHE_TIMEOUT
  })

  // Check if scope is currently loading
  const isScopeLoading = computed(() => (scope) => {
    return scopedNodesLoading.value.get(scope) || false
  })

  // Actions
  const clearCache = () => {
    // Clear scoped cache
    scopedComputeNodes.value.clear()
    scopedNodesLastFetched.value.clear()
    scopedNodesLoading.value.clear()

    computeAccounts.value = []
    computeAccountsLoaded.value = false
    computeAccountsLastFetched.value = null

    nodePermissions.value = {}
    permissionsLoaded.value = {}
    isLoadingPermissions.value = {}
    updateStates.value = {}
    nodeAllowedProcessors.value = {}
    allowedProcessorsLoaded.value = {}
    isLoadingAllowedProcessors.value = {}
    nodeLayers.value = {}
    layersLoaded.value = {}
    isLoadingLayers.value = {}

    nodeSecrets.value = {}
    nodeSharedSecrets.value = {}
    secretsLoaded.value = {}
    sharedSecretsLoaded.value = {}
    isLoadingSecrets.value = {}
    isLoadingSharedSecrets.value = {}

    gpuTiers.value = []
    gpuTiersLoaded.value = false
  }

  const setNodeUpdating = (nodeId, isUpdating) => {
    updateStates.value[nodeId] = isUpdating
  }

  // Delegate to scoped system for consistency
  const fetchComputeNodes = async (organizationId = null, forceRefresh = false) => {
    const scope = organizationId ? `workspace:${organizationId}` : 'account-owner'
    return fetchScopedComputeNodes(scope, organizationId, forceRefresh)
  }

  const fetchComputeAccounts = async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isComputeAccountsCacheValid.value && computeAccountsLoaded.value) {
      return computeAccounts.value
    }

    isLoadingComputeAccounts.value = true
    
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/accounts?includeWorkspaces=true`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        computeAccounts.value = data || []
        computeAccountsLoaded.value = true
        computeAccountsLastFetched.value = Date.now()
        return data
      } else {
        console.error('Failed to fetch compute accounts:', response.status, response.statusText)
        computeAccounts.value = []
        return Promise.reject(new Error(`Failed to fetch compute accounts: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch compute accounts:', error)
      computeAccounts.value = []
      return Promise.reject(error)
    } finally {
      isLoadingComputeAccounts.value = false
    }
  }

  const fetchNodePermissions = async (nodeId, forceRefresh = false) => {
    // Return cached permissions if available and not forcing refresh
    if (!forceRefresh && permissionsLoaded.value[nodeId]) {
      return nodePermissions.value[nodeId]
    }

    isLoadingPermissions.value[nodeId] = true

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Fetched permissions for node:', nodeId, data)
        
        // Derive accessScope if not provided
        if (!data.accessScope) {
          const hasSharedUsers = data.sharedWithUsers && data.sharedWithUsers.length > 0
          const hasSharedTeams = data.sharedWithTeams && data.sharedWithTeams.length > 0
          
          console.log('📊 Sharing status:', { hasSharedUsers, hasSharedTeams, users: data.sharedWithUsers, teams: data.sharedWithTeams })
          
          if (hasSharedUsers || hasSharedTeams) {
            data.accessScope = 'shared'
            console.log('✅ Setting access scope to shared')
          } else {
            data.accessScope = 'private'
            console.log('🔒 Setting access scope to private')
          }
        } else {
          console.log('📋 API provided explicit accessScope:', data.accessScope)
        }
        
        nodePermissions.value[nodeId] = data
        permissionsLoaded.value[nodeId] = true
        return data
      } else if (response.status === 403) {
        // User doesn't have permission to view permissions
        nodePermissions.value[nodeId] = { error: 'forbidden' }
        permissionsLoaded.value[nodeId] = true
        return nodePermissions.value[nodeId]
      } else {
        console.error('Failed to fetch node permissions:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to fetch node permissions: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch node permissions:', error)
      return Promise.reject(error)
    } finally {
      isLoadingPermissions.value[nodeId] = false
    }
  }

  const updateNodeStatus = async (nodeId, status) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}`
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        const updatedNode = await response.json()
        
        // Update the node in all scoped caches
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          const scopedNodeIndex = scopedNodes.findIndex(node => node.uuid === nodeId)
          if (scopedNodeIndex !== -1) {
            scopedNodes[scopedNodeIndex] = { ...scopedNodes[scopedNodeIndex], ...updatedNode }
          }
        }
        
        return updatedNode
      } else {
        console.error('Failed to update node status:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to update node status: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update node status:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const updateAccessScope = async (nodeId, accessScope) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions`
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessScope })
      })
      
      if (response.ok) {
        const updatedPermissions = await response.json()
        
        // Always preserve the user's intended access scope, even if no users/teams are shared yet
        updatedPermissions.accessScope = accessScope
        
        nodePermissions.value[nodeId] = updatedPermissions
        return updatedPermissions
      } else {
        console.error('Failed to update access scope:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to update access scope: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update access scope:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const addUserAccess = async (nodeId, userId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions/users`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })
      
      if (response.ok) {
        // Update cached permissions
        if (nodePermissions.value[nodeId]) {
          const currentPermissions = nodePermissions.value[nodeId]
          currentPermissions.sharedWithUsers = [...(currentPermissions.sharedWithUsers || []), userId]
          if (currentPermissions.accessScope !== 'shared') {
            currentPermissions.accessScope = 'shared'
          }
        }
        return true
      } else {
        console.error('Failed to add user access:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to add user access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to add user access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const removeUserAccess = async (nodeId, userId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions/users/${userId}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        // Update cached permissions
        if (nodePermissions.value[nodeId]) {
          const currentPermissions = nodePermissions.value[nodeId]
          currentPermissions.sharedWithUsers = (currentPermissions.sharedWithUsers || []).filter(id => id !== userId)
          
          // If no more shared users or teams, revert to private
          if ((currentPermissions.sharedWithUsers?.length || 0) === 0 && 
              (currentPermissions.sharedWithTeams?.length || 0) === 0) {
            currentPermissions.accessScope = 'private'
          }
        }
        return true
      } else {
        console.error('Failed to remove user access:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to remove user access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to remove user access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const addTeamAccess = async (nodeId, teamId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions/teams`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamId })
      })
      
      if (response.ok) {
        // Update cached permissions
        if (nodePermissions.value[nodeId]) {
          const currentPermissions = nodePermissions.value[nodeId]
          currentPermissions.sharedWithTeams = [...(currentPermissions.sharedWithTeams || []), teamId]
          if (currentPermissions.accessScope !== 'shared') {
            currentPermissions.accessScope = 'shared'
          }
        }
        return true
      } else {
        console.error('Failed to add team access:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to add team access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to add team access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const removeTeamAccess = async (nodeId, teamId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/permissions/teams/${teamId}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        // Update cached permissions
        if (nodePermissions.value[nodeId]) {
          const currentPermissions = nodePermissions.value[nodeId]
          currentPermissions.sharedWithTeams = (currentPermissions.sharedWithTeams || []).filter(id => id !== teamId)
          
          // If no more shared users or teams, revert to private
          if ((currentPermissions.sharedWithUsers?.length || 0) === 0 && 
              (currentPermissions.sharedWithTeams?.length || 0) === 0) {
            currentPermissions.accessScope = 'private'
          }
        }
        return true
      } else {
        console.error('Failed to remove team access:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to remove team access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to remove team access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  // Account management methods
  const updateAccountStatus = async (accountUuid, status) => {
    setNodeUpdating(accountUuid, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/accounts/${accountUuid}`
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        const updatedAccount = await response.json()
        
        // Update the account in the cache
        const accountIndex = computeAccounts.value.findIndex(account => account.uuid === accountUuid)
        if (accountIndex !== -1) {
          computeAccounts.value[accountIndex] = { 
            ...computeAccounts.value[accountIndex], 
            ...updatedAccount 
          }
        }
        
        return updatedAccount
      } else {
        console.error('Failed to update account status:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to update account status: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update account status:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(accountUuid, false)
    }
  }

  const updateAccount = async (accountUuid, changes) => {
    setNodeUpdating(accountUuid, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/accounts/${accountUuid}`
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: changes.name || null,
          description: changes.description || null,
          status: changes.status
        })
      })
      
      if (response.ok) {
        const updatedAccount = await response.json()
        
        // Update the account in the cache, preserving existing data like workspaces
        const accountIndex = computeAccounts.value.findIndex(account => account.uuid === accountUuid)
        if (accountIndex !== -1) {
          computeAccounts.value[accountIndex] = { 
            ...computeAccounts.value[accountIndex], 
            ...updatedAccount 
          }
        }
        
        return updatedAccount
      } else {
        console.error('Failed to update account:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to update account: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update account:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(accountUuid, false)
    }
  }

  const addWorkspaceAccess = async (accountUuid, organizationId, isPublic, enableCompute = true, enableStorage = true) => {
    setNodeUpdating(accountUuid, true)

    try {
      const token = await useGetToken()
      const encodedOrgId = encodeURIComponent(organizationId)
      const url = `${siteConfig.api2Url}/compute/resources/accounts/${accountUuid}/workspaces?organization_id=${encodedOrgId}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPublic, enableCompute, enableStorage })
      })

      if (response.ok) {
        // Add the new workspace to the local state
        const accountIndex = computeAccounts.value.findIndex(account => account.uuid === accountUuid)
        if (accountIndex !== -1) {
          const newWorkspace = {
            organizationId,
            isPublic,
            enableCompute,
            enableStorage,
            enabledBy: 'current-user', // This should be set from the user profile
            enabledAt: Math.floor(Date.now() / 1000)
          }
          
          const currentWorkspaces = computeAccounts.value[accountIndex].enabledWorkspaces || []
          computeAccounts.value[accountIndex] = {
            ...computeAccounts.value[accountIndex],
            enabledWorkspaces: [...currentWorkspaces, newWorkspace]
          }
        }
        
        return true
      } else {
        const errorText = await response.text()
        console.error('Failed to add workspace access:', response.status, response.statusText, errorText)
        return Promise.reject(new Error(`Failed to add workspace access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to add workspace access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(accountUuid, false)
    }
  }

  const removeWorkspaceAccess = async (accountUuid, organizationId) => {
    setNodeUpdating(accountUuid, true)

    try {
      const token = await useGetToken()
      const encodedOrgId = encodeURIComponent(organizationId)
      const url = `${siteConfig.api2Url}/compute/resources/accounts/${accountUuid}/workspaces/${encodedOrgId}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        // Remove the workspace from the local state
        const accountIndex = computeAccounts.value.findIndex(account => account.uuid === accountUuid)
        if (accountIndex !== -1) {
          const updatedWorkspaces = computeAccounts.value[accountIndex].enabledWorkspaces?.filter(
            ws => ws.organizationId !== organizationId
          ) || []
          computeAccounts.value[accountIndex] = {
            ...computeAccounts.value[accountIndex],
            enabledWorkspaces: updatedWorkspaces
          }
        }
        
        return true
      } else {
        const errorBody = await response.text()
        console.error('Failed to remove workspace access:', response.status, errorBody)
        return Promise.reject(new Error(errorBody || `Failed to remove workspace access: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to remove workspace access:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(accountUuid, false)
    }
  }

  // Compute Node CRUD Operations
  const createComputeNode = async (newComputeNode) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newComputeNode)
      })
      
      if (response.ok) {
        const createdNode = await response.json()
        
        // Add the new node to relevant scoped caches and sort them
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          // Add to account-owner scope (always relevant for user's nodes)
          if (scope === 'account-owner') {
            const updatedNodes = [...scopedNodes, createdNode].sort((a, b) => {
              const nameA = (a.name || '').toLowerCase()
              const nameB = (b.name || '').toLowerCase()
              return nameA.localeCompare(nameB)
            })
            scopedComputeNodes.value.set(scope, updatedNodes)
          }
        }
        
        return createdNode
      } else {
        const errorDetails = await response.text()
        console.error('Failed to create compute node:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to create compute node: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to create compute node:', error)
      return Promise.reject(error)
    }
  }

  const deleteComputeNode = async (nodeUuid) => {
    setNodeUpdating(nodeUuid, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        // Remove the node from all scoped caches
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          const updatedNodes = scopedNodes.filter(node => node.uuid !== nodeUuid)
          scopedComputeNodes.value.set(scope, updatedNodes)
        }
        
        // Clean up permissions cache
        if (nodePermissions.value[nodeUuid]) {
          delete nodePermissions.value[nodeUuid]
          delete permissionsLoaded.value[nodeUuid]
          delete isLoadingPermissions.value[nodeUuid]
        }
        
        return true
      } else {
        const errorDetails = await response.text()
        console.error('Failed to delete compute node:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to delete compute node: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to delete compute node:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeUuid, false)
    }
  }

  const editComputeNode = async (nodeUuid, updates) => {
    setNodeUpdating(nodeUuid, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        const updatedNode = await response.json()
        
        // Update the node in all scoped caches and re-sort if name changed
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          const nodeIndex = scopedNodes.findIndex(node => node.uuid === nodeUuid)
          if (nodeIndex !== -1) {
            // Update the node
            scopedNodes[nodeIndex] = { ...scopedNodes[nodeIndex], ...updatedNode }
            
            // Re-sort if name might have changed
            if (updates.name) {
              const sortedNodes = [...scopedNodes].sort((a, b) => {
                const nameA = (a.name || '').toLowerCase()
                const nameB = (b.name || '').toLowerCase()
                return nameA.localeCompare(nameB)
              })
              scopedComputeNodes.value.set(scope, sortedNodes)
            }
          }
        }
        
        return updatedNode
      } else {
        const errorDetails = await response.text()
        console.error('Failed to edit compute node:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to edit compute node: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to edit compute node:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeUuid, false)
    }
  }


  // Method for fetching scoped compute nodes with caching
  const fetchScopedComputeNodes = async (scope, organizationId = null, forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isScopedCacheValid.value(scope)) {
      return getScopedComputeNodes.value(scope)
    }

    // Prevent multiple simultaneous requests for the same scope
    if (isScopeLoading.value(scope)) {
      // Wait for existing request to complete
      while (isScopeLoading.value(scope)) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return getScopedComputeNodes.value(scope)
    }

    // Set loading state
    scopedNodesLoading.value.set(scope, true)
    
    try {
      const token = await useGetToken()
      
      let url = `${siteConfig.api2Url}/compute/resources/compute-nodes`
      
      // Build URL based on scope
      if (scope === 'account-owner') {
        url += '?account_owner=true'
      } else if (scope.startsWith('workspace:') && organizationId) {
        url += `?organization_id=${organizationId}`
      } else {
        throw new Error(`Invalid scope: ${scope}`)
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Sort nodes by name for consistent ordering
        const sortedData = Array.isArray(data) ? data.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase()
          const nameB = (b.name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        }) : data
        
        // Cache the results in scoped cache
        scopedComputeNodes.value.set(scope, sortedData)
        scopedNodesLastFetched.value.set(scope, Date.now())
        
        return sortedData
      } else {
        const errorText = await response.text()
        console.error(`Failed to fetch compute nodes for scope ${scope}:`, response.status, response.statusText, errorText)
        return Promise.reject(new Error(`Failed to fetch compute nodes for scope ${scope}: ${response.statusText}`))
      }
    } catch (error) {
      console.error(`Error fetching compute nodes for scope ${scope}:`, error)
      return Promise.reject(error)
    } finally {
      scopedNodesLoading.value.set(scope, false)
    }
  }

  // PATCH method for compute node updates (name, description, status)
  const updateComputeNode = async (nodeUuid, changes) => {
    setNodeUpdating(nodeUuid, true)
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changes)
      })
      
      if (response.ok) {
        const updatedNode = await response.json()
        
        // Update the node in all scoped caches and re-sort if name changed
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          const nodeIndex = scopedNodes.findIndex(node => node.uuid === nodeUuid)
          if (nodeIndex !== -1) {
            // Update the node
            scopedNodes[nodeIndex] = { ...scopedNodes[nodeIndex], ...updatedNode }
            
            // Re-sort if name might have changed
            if (changes.name) {
              const sortedNodes = [...scopedNodes].sort((a, b) => {
                const nameA = (a.name || '').toLowerCase()
                const nameB = (b.name || '').toLowerCase()
                return nameA.localeCompare(nameB)
              })
              scopedComputeNodes.value.set(scope, sortedNodes)
            }
          }
        }
        
        return updatedNode
      } else {
        const errorDetails = await response.text()
        console.error('Failed to update compute node:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to update compute node: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to update compute node:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeUuid, false)
    }
  }

  // PATCH method for compute node status only
  const updateComputeNodeStatus = async (nodeUuid, status) => {
    setNodeUpdating(nodeUuid, true)
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        // Update the node status in all scoped caches
        for (const [scope, scopedNodes] of scopedComputeNodes.value.entries()) {
          const nodeIndex = scopedNodes.findIndex(node => node.uuid === nodeUuid)
          if (nodeIndex !== -1) {
            scopedNodes[nodeIndex] = { ...scopedNodes[nodeIndex], status }
          }
        }
        
        return true
      } else {
        const errorDetails = await response.text()
        console.error('Failed to update compute node status:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to update compute node status: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to update compute node status:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeUuid, false)
    }
  }

  // PUT method for compute node update (provisioner image)
  const updateComputeNodeDeployment = async (nodeUuid, { provisionerImage, provisionerImageTag }) => {
    setNodeUpdating(nodeUuid, true)
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provisionerImage, provisionerImageTag })
      })

      if (response.ok) {
        const result = await response.json()
        return result
      } else {
        const errorDetails = await response.text()
        console.error('Failed to update compute node deployment:', response.status, response.statusText, errorDetails)
        return Promise.reject(new Error(`Failed to update compute node deployment: ${response.statusText} - ${errorDetails}`))
      }
    } catch (error) {
      console.error('Failed to update compute node deployment:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeUuid, false)
    }
  }

  // Secrets Actions
  const fetchSecrets = async (nodeId, forceRefresh = false) => {
    if (!forceRefresh && secretsLoaded.value[nodeId]) {
      return nodeSecrets.value[nodeId]
    }
    isLoadingSecrets.value[nodeId] = true
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/secrets`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        nodeSecrets.value[nodeId] = data.keys || []
        secretsLoaded.value[nodeId] = true
        return nodeSecrets.value[nodeId]
      } else if (response.status === 404) {
        nodeSecrets.value[nodeId] = []
        secretsLoaded.value[nodeId] = true
        return []
      } else {
        console.error('Failed to fetch secrets:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to fetch secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch secrets:', error)
      return Promise.reject(error)
    } finally {
      isLoadingSecrets.value[nodeId] = false
    }
  }

  const patchSecrets = async (nodeId, secrets) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/secrets`
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secrets })
      })
      if (response.ok) {
        // Merge new keys into existing cache
        const existing = new Set(nodeSecrets.value[nodeId] || [])
        for (const key of Object.keys(secrets)) {
          existing.add(key)
        }
        nodeSecrets.value[nodeId] = [...existing]
        return true
      } else {
        const errorText = await response.text()
        console.error('Failed to update secrets:', response.status, errorText)
        return Promise.reject(new Error(`Failed to update secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update secrets:', error)
      return Promise.reject(error)
    }
  }

  const deleteSecret = async (nodeId, key) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/secrets?key=${encodeURIComponent(key)}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        nodeSecrets.value[nodeId] = (nodeSecrets.value[nodeId] || []).filter(k => k !== key)
        return true
      } else {
        console.error('Failed to delete secret:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to delete secret: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete secret:', error)
      return Promise.reject(error)
    }
  }

  const deleteAllSecrets = async (nodeId) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/secrets?deleteAll=true`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        nodeSecrets.value[nodeId] = []
        return true
      } else {
        console.error('Failed to delete all secrets:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to delete all secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete all secrets:', error)
      return Promise.reject(error)
    }
  }

  const fetchSharedSecrets = async (nodeId, forceRefresh = false) => {
    if (!forceRefresh && sharedSecretsLoaded.value[nodeId]) {
      return nodeSharedSecrets.value[nodeId]
    }
    isLoadingSharedSecrets.value[nodeId] = true
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/shared-secrets`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        nodeSharedSecrets.value[nodeId] = data.keys || []
        sharedSecretsLoaded.value[nodeId] = true
        return nodeSharedSecrets.value[nodeId]
      } else if (response.status === 404) {
        nodeSharedSecrets.value[nodeId] = []
        sharedSecretsLoaded.value[nodeId] = true
        return []
      } else {
        console.error('Failed to fetch shared secrets:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to fetch shared secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch shared secrets:', error)
      return Promise.reject(error)
    } finally {
      isLoadingSharedSecrets.value[nodeId] = false
    }
  }

  const patchSharedSecrets = async (nodeId, secrets) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/shared-secrets`
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secrets })
      })
      if (response.ok) {
        // Merge new keys into existing cache
        const existing = new Set(nodeSharedSecrets.value[nodeId] || [])
        for (const key of Object.keys(secrets)) {
          existing.add(key)
        }
        nodeSharedSecrets.value[nodeId] = [...existing]
        return true
      } else {
        const errorText = await response.text()
        console.error('Failed to update shared secrets:', response.status, errorText)
        return Promise.reject(new Error(`Failed to update shared secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update shared secrets:', error)
      return Promise.reject(error)
    }
  }

  const deleteSharedSecret = async (nodeId, key) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/shared-secrets?key=${encodeURIComponent(key)}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        nodeSharedSecrets.value[nodeId] = (nodeSharedSecrets.value[nodeId] || []).filter(k => k !== key)
        return true
      } else {
        console.error('Failed to delete shared secret:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to delete shared secret: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete shared secret:', error)
      return Promise.reject(error)
    }
  }

  const deleteAllSharedSecrets = async (nodeId) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/shared-secrets?deleteAll=true`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        nodeSharedSecrets.value[nodeId] = []
        return true
      } else {
        console.error('Failed to delete all shared secrets:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to delete all shared secrets: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete all shared secrets:', error)
      return Promise.reject(error)
    }
  }

  // Allowed Processors
  const fetchAllowedProcessors = async (nodeId, forceRefresh = false) => {
    if (!forceRefresh && allowedProcessorsLoaded.value[nodeId]) {
      return nodeAllowedProcessors.value[nodeId]
    }
    isLoadingAllowedProcessors.value[nodeId] = true
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/allowed-processors`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        nodeAllowedProcessors.value[nodeId] = data.processors || []
        allowedProcessorsLoaded.value[nodeId] = true
        return nodeAllowedProcessors.value[nodeId]
      } else if (response.status === 403) {
        // Non-owner — no access to manage processors
        nodeAllowedProcessors.value[nodeId] = []
        allowedProcessorsLoaded.value[nodeId] = true
        return []
      } else {
        console.error('Failed to fetch allowed processors:', response.status)
        return Promise.reject(new Error(`Failed to fetch allowed processors: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch allowed processors:', error)
      return Promise.reject(error)
    } finally {
      isLoadingAllowedProcessors.value[nodeId] = false
    }
  }

  const updateAllowedProcessors = async (nodeId, processors) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/allowed-processors`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ processors })
      })
      if (response.ok) {
        nodeAllowedProcessors.value[nodeId] = [...processors]
        return true
      } else {
        const errorText = await response.text()
        console.error('Failed to update allowed processors:', response.status, errorText)
        return Promise.reject(new Error(`Failed to update allowed processors: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update allowed processors:', error)
      return Promise.reject(error)
    }
  }

  // Update compute node infrastructure config (GPU, LLM)
  const updateComputeNodeConfig = async (nodeId, config) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeId}/update-config`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      if (response.ok) {
        return await response.json()
      } else {
        const errorText = await response.text()
        console.error('Failed to update compute node config:', response.status, errorText)
        return Promise.reject(new Error(`Failed to update config: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update compute node config:', error)
      return Promise.reject(error)
    }
  }

  // Fetch GPU tiers
  const gpuTiers = ref([])
  const gpuTiersLoaded = ref(false)

  const fetchGpuTiers = async (orgId) => {
    if (gpuTiersLoaded.value) return gpuTiers.value
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/gpu-tiers?organization_id=${orgId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        gpuTiers.value = await response.json()
        gpuTiersLoaded.value = true
        return gpuTiers.value
      }
      return []
    } catch (error) {
      console.error('Failed to fetch GPU tiers:', error)
      return []
    }
  }

  // Persistent Layers (uses workflow service base path)
  const fetchNodeLayers = async (nodeId, forceRefresh = false) => {
    if (!forceRefresh && layersLoaded.value[nodeId]) {
      return nodeLayers.value[nodeId]
    }
    isLoadingLayers.value[nodeId] = true
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/workflows/compute-nodes/${nodeId}/layers`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        nodeLayers.value[nodeId] = {
          layers: data.layers || [],
          totalSizeGB: data.totalSizeGB || 0,
          totalEstimatedMonthlyCostUsd: data.totalEstimatedMonthlyCostUsd || 0
        }
        layersLoaded.value[nodeId] = true
        return nodeLayers.value[nodeId]
      } else if (response.status === 403) {
        nodeLayers.value[nodeId] = { layers: [], totalSizeGB: 0, totalEstimatedMonthlyCostUsd: 0 }
        layersLoaded.value[nodeId] = true
        return nodeLayers.value[nodeId]
      } else {
        console.error('Failed to fetch layers:', response.status)
        return Promise.reject(new Error(`Failed to fetch layers: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch layers:', error)
      return Promise.reject(error)
    } finally {
      isLoadingLayers.value[nodeId] = false
    }
  }

  const createNodeLayer = async (nodeId, { layerName, description }) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/workflows/compute-nodes/${nodeId}/layers`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ layerName, description })
      })
      if (response.ok) {
        await fetchNodeLayers(nodeId, true)
        return true
      } else if (response.status === 409) {
        return Promise.reject(new Error('A layer with that name already exists'))
      } else {
        const errorText = await response.text()
        console.error('Failed to create layer:', response.status, errorText)
        return Promise.reject(new Error(`Failed to create layer: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to create layer:', error)
      return Promise.reject(error)
    }
  }

  const deleteNodeLayer = async (nodeId, layerName) => {
    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/workflows/compute-nodes/${nodeId}/layers/${encodeURIComponent(layerName)}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        await fetchNodeLayers(nodeId, true)
        return true
      } else {
        console.error('Failed to delete layer:', response.status)
        return Promise.reject(new Error(`Failed to delete layer: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete layer:', error)
      return Promise.reject(error)
    }
  }

  return {
    // State - Accounts
    computeAccounts,
    computeAccountsLoaded,
    isLoadingComputeAccounts,
    
    // State - Permissions
    nodePermissions,
    
    // State - Scoped compute nodes
    scopedComputeNodes,
    scopedNodesLastFetched,
    scopedNodesLoading,
    
    // Getters
    getComputeNodeById,
    getNodePermissions,
    isNodeUpdating,
    isNodePermissionsLoading,
    isComputeAccountsCacheValid,
    getComputeNodesForAccount,
    getScopedComputeNodes,
    isScopedCacheValid,
    isScopeLoading,
    
    // Actions - Nodes
    clearCache,
    fetchComputeNodes,
    fetchScopedComputeNodes,
    fetchNodePermissions,
    updateNodeStatus,
    updateAccessScope,
    addUserAccess,
    removeUserAccess,
    addTeamAccess,
    removeTeamAccess,
    
    // CRUD Operations
    createComputeNode,
    deleteComputeNode,
    editComputeNode,
    
    // PATCH Operations for compute nodes
    updateComputeNode,
    updateComputeNodeStatus,
    updateComputeNodeDeployment,
    
    // Getters - Secrets
    getNodeSecrets,
    getNodeSharedSecrets,
    isNodeSecretsLoading,
    isNodeSharedSecretsLoading,

    // Actions - Secrets
    fetchSecrets,
    patchSecrets,
    deleteSecret,
    deleteAllSecrets,
    fetchSharedSecrets,
    patchSharedSecrets,
    deleteSharedSecret,
    deleteAllSharedSecrets,

    // Getters - Allowed Processors
    getNodeAllowedProcessors,
    isNodeAllowedProcessorsLoading,

    // Actions - Allowed Processors
    fetchAllowedProcessors,
    updateAllowedProcessors,

    // Getters - Layers
    getNodeLayers,
    isNodeLayersLoading,

    // Actions - Infrastructure Config
    updateComputeNodeConfig,
    gpuTiers,
    fetchGpuTiers,

    // Actions - Layers
    fetchNodeLayers,
    createNodeLayer,
    deleteNodeLayer,

    // Actions - Accounts
    fetchComputeAccounts,
    updateAccount,
    updateAccountStatus,
    addWorkspaceAccess,
    removeWorkspaceAccess,
    setNodeUpdating
  }
})