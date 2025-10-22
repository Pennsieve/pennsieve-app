import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'

export function useTemplateVersions(props, template) {
  const selectedVersion = ref('latest')
  const availableVersions = ref([])
  const currentVersionData = ref(null)
  const loadingVersion = ref(false)
  const config = window.config || {}

  // Fetch all versions for a template
  const fetchVersions = async () => {
    if (!template.value || !template.value.id) {
      console.warn('No template available to fetch versions')
      return
    }

    try {
      const token = await useGetToken()
      const url = `${config.apiUrl}/metadata/templates/${template.value.id}/versions?api_key=${token}`
      
      const response = await useSendXhr(url, {
        method: 'GET'
      })

      // Transform the response into version options
      if (response && response.data) {
        availableVersions.value = [
          { label: 'Latest', value: 'latest' },
          ...response.data.map(v => ({
            label: `Version ${v.version}`,
            value: v.id
          }))
        ]
      }
    } catch (error) {
      console.error('Failed to fetch template versions:', error)
      availableVersions.value = [{ label: 'Latest', value: 'latest' }]
    }
  }

  // Fetch a specific version of the template
  const fetchVersion = async (versionId) => {
    if (!template.value || !template.value.id) {
      console.warn('No template available to fetch version')
      return
    }

    if (versionId === 'latest') {
      currentVersionData.value = null
      return
    }

    loadingVersion.value = true
    try {
      const token = await useGetToken()
      const url = `${config.apiUrl}/metadata/templates/${template.value.id}/versions/${versionId}?api_key=${token}`
      
      const response = await useSendXhr(url, {
        method: 'GET'
      })

      currentVersionData.value = response.data
    } catch (error) {
      console.error('Failed to fetch template version:', error)
      currentVersionData.value = null
    } finally {
      loadingVersion.value = false
    }
  }

  // Create a new version of the template
  const createNewVersion = async () => {
    if (!template.value || !template.value.id) {
      console.warn('No template available to create new version')
      return
    }

    try {
      const token = await useGetToken()
      const url = `${config.apiUrl}/metadata/templates/${template.value.id}/versions?api_key=${token}`
      
      // Get the current template data to use as basis for new version
      const currentData = currentVersionData.value || template.value.latest_version
      
      const payload = {
        schema: currentData.schema,
        description: currentData.description || '',
        // Add any other necessary fields for version creation
      }

      const response = await useSendXhr(url, {
        method: 'POST',
        body: payload
      })

      // Refresh versions list after creating new version
      await fetchVersions()
      
      // Select the newly created version
      if (response && response.data && response.data.id) {
        selectedVersion.value = response.data.id
        await fetchVersion(response.data.id)
      }

      return response.data
    } catch (error) {
      console.error('Failed to create new template version:', error)
      throw error
    }
  }

  return {
    selectedVersion,
    availableVersions,
    currentVersionData,
    loadingVersion,
    fetchVersions,
    fetchVersion,
    createNewVersion
  }
}