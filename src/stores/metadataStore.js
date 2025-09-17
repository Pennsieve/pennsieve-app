// @/stores/metadataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";
import { propOr, propEq, findIndex } from 'ramda'

import vuexStore from '../store/index'  // Assuming your Vuex store is exported from vuexStore.js

export const useMetadataStore = defineStore('metadata', () => {

    // Models is an array of metadata models
    const currentDatasetID = ref("")
    const modelsLoaded = ref(false)
    const models = ref([])


    // ----ACTIONS----
    const setDatasetModels = (newModels) => {
        if(!models) {
            models.value = []
        } else {
            models.value = newModels
        }
    }

    const fetchModels = async (datasetId) => {
        try {
            // Set the current datasetID
            currentDatasetID.value = datasetId

            let endpoint = `${site.api2Url}/metadata/models`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const response = await resp.json()
                setDatasetModels(response)
                modelsLoaded.value = true
                return response
            } else {
                modelsLoaded.value = false
                return Promise.reject(resp)
            }
        } catch (err) {
            modelsLoaded.value = false
            return Promise.reject(err)
        }
    }

    const modelById = (id) => {

        for (const item of models.value) {
            if (item.model.id === id) {
                return item.model
            }
        }

        return null
    }

    // Fetch a specific version of a model
    const fetchModelVersion = async (datasetId, modelId, versionNumber) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/versions/${versionNumber}`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const versionData = await resp.json()
                return versionData
            } else {
                throw new Error(`Failed to fetch model version: ${resp.statusText}`)
            }
        } catch (error) {
            console.error('Error fetching model version:', error)
            throw error
        }
    }

    // Fetch all available versions for a model
    const fetchModelVersions = async (datasetId, modelId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/versions`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const versions = await resp.json()
                return versions
            } else {
                throw new Error(`Failed to fetch model versions: ${resp.statusText}`)
            }
        } catch (error) {
            console.error('Error fetching model versions:', error)
            throw error
        }
    }

    // Fetch all available templates
    const fetchTemplates = async () => {
        try {
            const endpoint = `${site.api2Url}/metadata/templates`
            const token = await useGetToken()

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(endpoint, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const templates = await resp.json()
                return templates
            } else {
                throw new Error(`Failed to fetch templates: ${resp.statusText}`)
            }
        } catch (error) {
            console.error('Error fetching templates:', error)
            throw error
        }
    }

    // Create a new model - can be from scratch or from a template
    const createModel = async (datasetId, modelData) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            // Ensure the model data has the correct structure
            const payload = {
                name: modelData.name,
                display_name: modelData.display_name || modelData.name,
                description: modelData.description || '',
                schema: modelData.schema || modelData.latest_version?.schema
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const createdModel = await resp.json()
                // Refresh models list after successful creation
                await fetchModels(datasetId)
                return createdModel
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create model: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating model:', error)
            throw error
        }
    }

    // Create multiple models - useful for creating from multiple templates
    const createModels = async (datasetId, modelsArray) => {
        const results = {
            successful: [],
            failed: [],
            total: modelsArray.length
        }

        // Process models one by one since API only supports single model creation
        for (const modelData of modelsArray) {
            try {
                const createdModel = await createModel(datasetId, modelData)
                results.successful.push({
                    model: createdModel,
                    source: modelData
                })
            } catch (error) {
                results.failed.push({
                    source: modelData,
                    error: error.message
                })
            }
        }

        return results
    }

    // Update an existing model to create a new version
    const updateVersion = async (datasetId, modelId, modelData) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/versions`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            // Create payload for new version
            const payload = {
                schema: modelData.schema
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const newVersion = await resp.json()
                // Refresh models list after successful version creation
                await fetchModels(datasetId)
                return newVersion
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create new version: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating new version:', error)
            throw error
        }
    }

    return {
        // State
        models,
        currentDatasetID,
        modelsLoaded,

        // Getters


        // Actions
        fetchModels,
        modelById,
        fetchModelVersion,
        fetchModelVersions,
        fetchTemplates,
        createModel,
        createModels,
        updateVersion
    }

})