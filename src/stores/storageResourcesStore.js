// @/stores/storageResourcesStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

export const useStorageResourcesStore = defineStore('storageResources', () => {
  // Scoped storage nodes cache
  const scopedStorageNodes = ref(new Map())
  const scopedNodesLastFetched = ref(new Map())
  const scopedNodesLoading = ref(new Map())

  // Update states - keyed by nodeId
  const updateStates = ref({})

  // Detach impact cache - keyed by `${nodeId}:${orgId}`
  const detachImpactCache = ref({})
  const isLoadingDetachImpact = ref({})

  // Cache timeout (5 minutes)
  const CACHE_TIMEOUT = 5 * 60 * 1000

  // Getters
  const getScopedStorageNodes = computed(() => (scope) => {
    return scopedStorageNodes.value.get(scope) || []
  })

  const isScopedCacheValid = computed(() => (scope) => {
    const lastFetched = scopedNodesLastFetched.value.get(scope)
    if (!lastFetched) return false
    return (Date.now() - lastFetched) < CACHE_TIMEOUT
  })

  const isScopeLoading = computed(() => (scope) => {
    return scopedNodesLoading.value.get(scope) || false
  })

  const isNodeUpdating = computed(() => (nodeId) => {
    return updateStates.value[nodeId] || false
  })

  const getStorageNodeById = computed(() => (nodeId, scope = 'account-owner') => {
    const nodes = scopedStorageNodes.value.get(scope) || []
    return nodes.find(node => node.uuid === nodeId)
  })

  const getDetachImpact = computed(() => (nodeId, orgId) => {
    return detachImpactCache.value[`${nodeId}:${orgId}`] || null
  })

  const isDetachImpactLoading = computed(() => (nodeId, orgId) => {
    return isLoadingDetachImpact.value[`${nodeId}:${orgId}`] || false
  })

  // Actions
  const clearCache = () => {
    scopedStorageNodes.value.clear()
    scopedNodesLastFetched.value.clear()
    scopedNodesLoading.value.clear()
    updateStates.value = {}
    detachImpactCache.value = {}
    isLoadingDetachImpact.value = {}
  }

  const setNodeUpdating = (nodeId, isUpdating) => {
    updateStates.value[nodeId] = isUpdating
  }

  const fetchStorageNodes = async (organizationId = null, forceRefresh = false) => {
    const scope = organizationId ? `workspace:${organizationId}` : 'account-owner'
    return fetchScopedStorageNodes(scope, organizationId, forceRefresh)
  }

  const fetchScopedStorageNodes = async (scope, organizationId = null, forceRefresh = false) => {
    if (!forceRefresh && isScopedCacheValid.value(scope)) {
      return getScopedStorageNodes.value(scope)
    }

    if (isScopeLoading.value(scope)) {
      while (isScopeLoading.value(scope)) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return getScopedStorageNodes.value(scope)
    }

    scopedNodesLoading.value.set(scope, true)

    try {
      const token = await useGetToken()
      let url = `${siteConfig.api2Url}/compute/resources/storage-nodes`

      if (scope === 'account-owner') {
        url += '?account_owner=true'
      } else if (scope.startsWith('workspace:') && organizationId) {
        url += `?organization_id=${encodeURIComponent(organizationId)}`
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
        const sortedData = Array.isArray(data) ? data.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase()
          const nameB = (b.name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        }) : data

        scopedStorageNodes.value.set(scope, sortedData)
        scopedNodesLastFetched.value.set(scope, Date.now())
        return sortedData
      } else {
        const errorText = await response.text()
        console.error(`Failed to fetch storage nodes for scope ${scope}:`, response.status, errorText)
        return Promise.reject(new Error(`Failed to fetch storage nodes: ${response.statusText}`))
      }
    } catch (error) {
      console.error(`Error fetching storage nodes for scope ${scope}:`, error)
      return Promise.reject(error)
    } finally {
      scopedNodesLoading.value.set(scope, false)
    }
  }

  const updateStorageNode = async (nodeId, changes) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/storage-nodes/${nodeId}`

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

        // Update in all scoped caches
        for (const [, scopedNodes] of scopedStorageNodes.value.entries()) {
          const idx = scopedNodes.findIndex(node => node.uuid === nodeId)
          if (idx !== -1) {
            scopedNodes[idx] = { ...scopedNodes[idx], ...updatedNode }
          }
        }

        return updatedNode
      } else {
        console.error('Failed to update storage node:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to update storage node: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to update storage node:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const deleteStorageNode = async (nodeId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/storage-nodes/${nodeId}`

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove from all scoped caches
        for (const [scope, scopedNodes] of scopedStorageNodes.value.entries()) {
          const filtered = scopedNodes.filter(node => node.uuid !== nodeId)
          scopedStorageNodes.value.set(scope, filtered)
        }
        return true
      } else {
        console.error('Failed to delete storage node:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to delete storage node: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to delete storage node:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const fetchDetachImpact = async (nodeId, organizationId) => {
    const cacheKey = `${nodeId}:${organizationId}`
    isLoadingDetachImpact.value[cacheKey] = true

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/storage-nodes/${nodeId}/impact?organization_id=${encodeURIComponent(organizationId)}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        detachImpactCache.value[cacheKey] = data
        return data
      } else {
        console.error('Failed to fetch detach impact:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to fetch detach impact: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch detach impact:', error)
      return Promise.reject(error)
    } finally {
      isLoadingDetachImpact.value[cacheKey] = false
    }
  }

  const attachWorkspace = async (nodeId, workspaceId, isDefault = false) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/storage-nodes/${nodeId}/workspace`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspaceId, isDefault })
      })

      if (response.ok) {
        const data = await response.json()
        // Invalidate workspace scope cache so it re-fetches
        const scope = `workspace:${workspaceId}`
        scopedNodesLastFetched.value.delete(scope)
        return data
      } else {
        console.error('Failed to attach workspace:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to attach workspace: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to attach workspace:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  const detachWorkspace = async (nodeId, workspaceId) => {
    setNodeUpdating(nodeId, true)

    try {
      const token = await useGetToken()
      const url = `${siteConfig.api2Url}/compute/resources/storage-nodes/${nodeId}/workspace`

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspaceId })
      })

      if (response.ok) {
        // Remove from workspace scope cache
        const scope = `workspace:${workspaceId}`
        const nodes = scopedStorageNodes.value.get(scope) || []
        scopedStorageNodes.value.set(scope, nodes.filter(n => n.uuid !== nodeId))
        return true
      } else {
        console.error('Failed to detach workspace:', response.status, response.statusText)
        return Promise.reject(new Error(`Failed to detach workspace: ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to detach workspace:', error)
      return Promise.reject(error)
    } finally {
      setNodeUpdating(nodeId, false)
    }
  }

  return {
    // State
    scopedStorageNodes,
    updateStates,
    // Getters
    getScopedStorageNodes,
    isScopedCacheValid,
    isScopeLoading,
    isNodeUpdating,
    getStorageNodeById,
    getDetachImpact,
    isDetachImpactLoading,
    // Actions
    clearCache,
    setNodeUpdating,
    fetchStorageNodes,
    fetchScopedStorageNodes,
    updateStorageNode,
    deleteStorageNode,
    fetchDetachImpact,
    attachWorkspace,
    detachWorkspace,
  }
})
