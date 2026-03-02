/**
 * Composable for model version management
 * Handles version selection, fetching, and navigation
 */

import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'

export function useModelVersions(props, model) {
  const router = useRouter()
  const metadataStore = useMetadataStore()
  
  // Version state
  const selectedVersion = ref('latest')
  const availableVersions = ref([])
  const currentVersionData = ref(null)
  const loadingVersion = ref(false)
  const versionsData = ref([])

  /**
   * Fetch available versions for the model
   */
  const fetchVersions = async () => {
    if (!props.modelId || !props.datasetId) return
    
    try {
      // Fetch versions from API and store the full version data
      const response = await metadataStore.fetchModelVersions(props.datasetId, props.modelId)
      
      // Extract versions array from the nested response structure
      const versions = response?.model?.versions || []
      
      // Store the actual version data for later use
      versionsData.value = versions
      
      const versionOptions = []
      
      // Add latest option first
      const latestVersionNum = model.value?.latest_version?.version || 1
      versionOptions.push({
        value: 'latest',
        label: `Latest (v${latestVersionNum})`
      })
      
      // Add individual version options from API response
      if (versions && versions.length > 0) {
        versions.forEach(version => {
          versionOptions.push({
            value: version.version.toString(),
            label: `Version ${version.version}`,
            versionData: version // Store the full version data
          })
        })
      } else {
        // Fallback: create versions based on latest version number
        for (let i = latestVersionNum; i >= 1; i--) {
          versionOptions.push({
            value: i.toString(),
            label: `Version ${i}`
          })
        }
      }
      
      availableVersions.value = versionOptions
    } catch (error) {
      console.error('Error fetching model versions:', error)
      // Fallback to mock data on error
      const latestVersionNum = model.value?.latest_version?.version || 1
      const fallbackVersions = []
      
      fallbackVersions.push({
        value: 'latest',
        label: `Latest (v${latestVersionNum})`
      })
      
      for (let i = latestVersionNum; i >= 1; i--) {
        fallbackVersions.push({
          value: i.toString(),
          label: `Version ${i}`
        })
      }
      
      availableVersions.value = fallbackVersions
      versionsData.value = []
    }
  }

  /**
   * Get specific version data from stored versions (no API call needed)
   */
  const fetchVersion = (versionNumber) => {
    if (!props.modelId || !props.datasetId || versionNumber === 'latest') {
      currentVersionData.value = null
      return
    }
    
    loadingVersion.value = true
    
    try {
      const targetVersionNumber = parseInt(versionNumber)
      
      // First try to find it in the availableVersions options
      const versionOption = availableVersions.value.find(v => 
        v.value !== 'latest' && parseInt(v.value) === targetVersionNumber
      )
      
      if (versionOption && versionOption.versionData) {
        currentVersionData.value = versionOption.versionData
      } else {
        // Fallback: search in the raw versionsData array
        if (Array.isArray(versionsData.value)) {
          const foundVersion = versionsData.value.find(v => v.version === targetVersionNumber)
          
          if (foundVersion) {
            currentVersionData.value = foundVersion
          } else {
            console.warn(`Version ${versionNumber} not found in stored data`)
            currentVersionData.value = null
          }
        } else {
          console.warn(`versionsData is not an array: ${typeof versionsData.value}`)
          currentVersionData.value = null
        }
      }
    } catch (error) {
      console.error('Error loading model version:', error)
      currentVersionData.value = null
    } finally {
      loadingVersion.value = false
    }
  }

  /**
   * Handle creating a new version - navigates to edit route
   */
  const createNewVersion = () => {
    if (!props.modelId || !props.datasetId) {
      console.warn('Cannot create new version: missing modelId or datasetId')
      return
    }
    
    // Navigate to the edit route for creating a new version
    router.push({
      name: 'model-edit',
      params: {
        datasetId: props.datasetId,
        modelId: props.modelId
      }
    })
  }

  // Watch for version changes
  watch(selectedVersion, (newVersion) => {
    fetchVersion(newVersion)
  })

  return {
    // State
    selectedVersion,
    availableVersions,
    currentVersionData,
    loadingVersion,
    
    // Actions
    fetchVersions,
    fetchVersion,
    createNewVersion
  }
}