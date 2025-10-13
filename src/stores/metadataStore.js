// @/stores/metadataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";
import { propOr, propEq, findIndex } from 'ramda'

import vuexStore from '../store/index'
import {v1 as uuidv1} from "uuid";  // Assuming your Vuex store is exported from vuexStore.js

export const useMetadataStore = defineStore('metadata', () => {

    // Models is an array of metadata models
    const currentDatasetID = ref("")
    const modelsLoaded = ref(false)
    const models = ref([])
    
    // Templates is an array of metadata templates
    const templates = ref([])
    const templatesLoaded = ref(false)

    // Relationship creation state
    const activeRelationshipCreation = ref(null) // { sourceRecordId, sourceModelId, datasetId, sourceRecordName }
    
    // Package attachment state
    const activePackageAttachment = ref(null) // { recordId, modelId, datasetId, recordName }

    // RecordFilter are used to filter records in Record list
    const createFilter = () => {
        return {
            id: uuidv1(),
            type: '',
            target: '',
            targetLabel: '',
            property: '',
            propertyLabel: '',
            propertyType: '',
            operation: '',
            operationLabel: '',
            operators: [],
            value: '',
            isInvalid: false
        }
    }
    const recordFilterParams = [ createFilter() ]


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

    const templateById = (id) => {
        for (const item of templates.value) {
            // Check both direct template object and nested template structure
            if (item.id === id || item.template?.id === id) {
                return item.template || item
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
    const fetchTemplates = async (organizationId = null) => {
        try {
            const endpoint = `${site.api2Url}/metadata/templates`
            const token = await useGetToken()

            // Add organization_id query parameter if provided
            const queryParams = {}
            if (organizationId) {
                queryParams.organization_id = organizationId
            }

            const url = Object.keys(queryParams).length > 0 
                ? `${endpoint}?${toQueryParams(queryParams)}` 
                : endpoint

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const fetchedTemplates = await resp.json()
                
                // Transform the API response to match the expected component structure
                let transformedTemplates = []
                if (fetchedTemplates && Array.isArray(fetchedTemplates)) {
                    transformedTemplates = fetchedTemplates.map(template => ({
                        id: template.model_template?.id || template.id,
                        name: template.model_template?.name || template.name,
                        display_name: template.model_template?.display_name || template.display_name,
                        description: template.description || template.model_template?.description || '',
                        category: template.category || 'general', // Default category if not provided
                        tags: template.tags || [], // Default empty tags if not provided
                        latest_version: template.model_template?.latest_version || template.latest_version || {
                            version: 1,
                            schema: template.model_template?.latest_version?.schema || template.schema || {}
                        },
                        created_at: template.created_at || template.model_template?.created_at
                    }))
                }
                
                // Store transformed templates in state for centralized access
                templates.value = transformedTemplates
                templatesLoaded.value = true
                return transformedTemplates
            } else {
                templatesLoaded.value = false
                throw new Error(`Failed to fetch templates: ${resp.statusText}`)
            }
        } catch (error) {
            templatesLoaded.value = false
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

    // Update model metadata (display_name, description) without creating new version
    const updateModelMetadata = async (datasetId, modelId, metadata) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Content-Type', 'application/json')

            const resp = await fetch(url, {
                method: 'PATCH',
                headers: myHeaders,
                body: JSON.stringify(metadata)
            })

            if (!resp.ok) {
                const errorText = await resp.text()
                throw new Error(`Failed to update model metadata: ${resp.status} - ${errorText}`)
            }

            const response = await resp.json()

            // Reload models to reflect the updated metadata
            await fetchModels(datasetId)

            return response
        } catch (error) {
            console.error('Failed to update model metadata:', error)
            throw error
        }
    }

    // Create a model from a template
    const createModelFromTemplate = async (datasetId, templateId, modelData, templateVersion = null) => {
        try {
            const endpoint = `${site.api2Url}/metadata/templates/${templateId}/models`
            const token = await useGetToken()

            const queryParams = {
                dataset_id: datasetId
            }
            
            // Add version to query params if specified
            if (templateVersion) {
                queryParams.version = templateVersion
            }

            const url = `${endpoint}?${toQueryParams(queryParams)}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            const payload = {
                name: modelData.name,
                display_name: modelData.display_name || modelData.name,
                description: modelData.description || ''
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
                throw new Error(`Failed to create model from template: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating model from template:', error)
            throw error
        }
    }

    // Create multiple models from templates
    const createModelsFromTemplates = async (datasetId, templatesArray) => {
        const results = {
            successful: [],
            failed: [],
            total: templatesArray.length
        }

        // Process templates one by one
        for (const templateData of templatesArray) {
            try {
                const modelData = {
                    name: templateData.name || templateData.template.name,
                    display_name: templateData.display_name || templateData.template.display_name || templateData.template.name,
                    description: templateData.description || templateData.template.description || ''
                }

                const createdModel = await createModelFromTemplate(
                    datasetId, 
                    templateData.template.id,
                    modelData,
                    templateData.version || templateData.template.latest_version?.version
                )
                
                results.successful.push({
                    model: createdModel,
                    source: templateData
                })
            } catch (error) {
                results.failed.push({
                    source: templateData,
                    error: error.message
                })
            }
        }

        return results
    }

    // Create a template from a model
    const createTemplateFromModel = async (templateData, organizationId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/template`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                organization_id: organizationId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            const payload = {
                name: templateData.name,
                display_name: templateData.display_name,
                description: templateData.description,
                schema: templateData.schema
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const createdTemplate = await resp.json()
                return createdTemplate
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create template: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating template from model:', error)
            throw error
        }
    }

    // Create a new template version
    const createTemplateVersion = async (templateId, versionData, orgId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/templates/${templateId}/versions`
            const token = await useGetToken()
            
            const queryParams = {
                organization_id: orgId
            }
            
            const url = `${endpoint}?${toQueryParams(queryParams)}`
            
            const payload = {
                schema: versionData.schema
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const createdVersion = await resp.json()
                return createdVersion
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create template version: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating template version:', error)
            throw error
        }
    }

    // Fetch all versions of a template
    const fetchTemplateVersions = async (templateId, orgId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/templates/${templateId}/versions`
            const token = await useGetToken()
            
            const queryParams = {
                organization_id: orgId
            }
            
            const url = `${endpoint}?${toQueryParams(queryParams)}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (!resp.ok) {
                const errorText = await resp.text()
                throw new Error(`Failed to fetch template versions: ${resp.status} - ${errorText}`)
            }

            const data = await resp.json()
            // Handle the API response structure: {"model_template": {"versions": [...]}}
            return data.model_template?.versions || data.versions || data
        } catch (error) {
            console.error('Error fetching template versions:', error)
            throw error
        }
    }

    // Fetch records for a specific model
    const fetchRecords = async (datasetId, modelId, options = {}) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records/search`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId,
                page_size: options.limit || 25,
                ...options.cursor && { cursor: options.cursor },
                ...options.version && { version: options.version }
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            // Build search payload with filter support
            const payload = {
                ...options.searchCriteria && { search: options.searchCriteria },
                ...options.filter && { filter: options.filter }
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const response = await resp.json()
                return response
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to fetch records: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error fetching records:', error)
            throw error
        }
    }

    // Fetch a specific record by ID
    const fetchRecord = async (datasetId, modelId, recordId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records/${recordId}`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const response = await resp.json()
                return response
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to fetch record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error fetching record:', error)
            throw error
        }
    }

    // Create new record(s) for a model
    const createRecord = async (datasetId, modelId, recordData, modelVersion = null) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records`
            const token = await useGetToken()

            const queryParams = {
                dataset_id: datasetId
            }

            // Add version to query params if specified
            if (modelVersion) {
                queryParams.version = modelVersion
            }

            const url = `${endpoint}?${toQueryParams(queryParams)}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            // Ensure recordData is an array as expected by the API
            const payload = {
                records: Array.isArray(recordData) ? recordData : [recordData]
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                const response = await resp.json()
                return response
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating record:', error)
            throw error
        }
    }

    // Update an existing record to create a new version
    const updateRecord = async (datasetId, modelId, recordId, recordData) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records/${recordId}`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                dataset_id: datasetId
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            const payload = {
                record: recordData
            }

            const resp = await fetch(url, {
                method: 'PUT',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to update record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error updating record:', error)
            throw error
        }
    }

    /**
     * Create a relationship between records
     * @param {string} datasetId - The dataset ID
     * @param {string} sourceRecordId - The source record ID
     * @param {string} targetRecordId - The target record ID  
     * @param {string} relationshipType - The type of relationship
     * @returns {Promise<Object>} The created relationship
     */
    const createRelationship = async (datasetId, sourceRecordId, targetRecordId, relationshipType) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${sourceRecordId}/relationships`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            const payload = {
                target_record_id: targetRecordId,
                relationship_type: relationshipType
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to create relationship: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error creating relationship:', error)
            throw error
        }
    }

    /**
     * Search records across all models in a dataset
     * @param {string} datasetId - The dataset ID
     * @param {string} query - The search query
     * @param {number} limit - Maximum number of results to return
     * @returns {Promise<Array>} Array of matching records
     */
    const searchRecords = async (datasetId, query, limit = 20) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/search`
            const token = await useGetToken()
            const queryParams = toQueryParams({ 
                dataset_id: datasetId,
                query: query,
                limit: limit
            })
            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const data = await resp.json()
                return data.records || []
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to search records: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error searching records:', error)
            throw error
        }
    }

    /**
     * Attach a package (file/folder) to a record
     * @param {string} datasetId - The dataset ID
     * @param {string} recordId - The record ID to attach package to
     * @param {string} packageId - The package ID to attach
     * @returns {Promise<Object>} The attachment result
     */
    const attachPackageToRecord = async (datasetId, recordId, packageId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${recordId}/packages`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')

            const payload = {
                package_id: packageId
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders,
                body: JSON.stringify(payload)
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to attach package to record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error attaching package to record:', error)
            throw error
        }
    }

    // Relationship creation actions
    const startRelationshipCreation = (sourceRecordId, sourceModelId, datasetId, sourceRecordName) => {
        activeRelationshipCreation.value = {
            sourceRecordId,
            sourceModelId,
            datasetId,
            sourceRecordName
        }
    }

    const cancelRelationshipCreation = () => {
        activeRelationshipCreation.value = null
    }

    const completeRelationshipCreation = async (targetRecordId, relationshipType) => {
        if (!activeRelationshipCreation.value) {
            throw new Error('No active relationship creation in progress')
        }

        const { sourceRecordId, datasetId } = activeRelationshipCreation.value

        try {
            const result = await createRelationship(datasetId, sourceRecordId, targetRecordId, relationshipType)
            activeRelationshipCreation.value = null // Clear state after success
            return result
        } catch (error) {
            // Keep state on error so user can retry
            throw error
        }
    }

    // Package attachment actions
    const startPackageAttachment = (recordId, modelId, datasetId, recordName) => {
        activePackageAttachment.value = {
            recordId,
            modelId,
            datasetId,
            recordName
        }
    }

    const cancelPackageAttachment = () => {
        activePackageAttachment.value = null
    }

    const completePackageAttachment = async (packageId) => {
        if (!activePackageAttachment.value) {
            throw new Error('No active package attachment in progress')
        }

        const { recordId, datasetId } = activePackageAttachment.value

        try {
            const result = await attachPackageToRecord(datasetId, recordId, packageId)
            activePackageAttachment.value = null // Clear state after success
            return result
        } catch (error) {
            // Keep state on error so user can retry
            throw error
        }
    }

    // Fetch packages attached to a record
    const fetchRecordPackages = async (datasetId, recordId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${recordId}/packages`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            
            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to fetch record packages: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error fetching record packages:', error)
            throw error
        }
    }

     // Fetch relationships for a record
    const fetchRecordRelationships = async (datasetId, recordId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${recordId}/relationships`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            
            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                // Return empty array for 404 (no relationships) instead of throwing error
                if (resp.status === 404) {
                    return []
                }
                const errorText = await resp.text()
                throw new Error(`Failed to fetch record relationships: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error fetching record relationships:', error)
            throw error
        }
    }

    // Delete a package from a record
    const deletePackageFromRecord = async (datasetId, recordId, packageId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${recordId}/packages/${encodeURIComponent(packageId)}`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            
            const resp = await fetch(url, {
                method: 'DELETE',
                headers: myHeaders
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to delete package from record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error deleting package from record:', error)
            throw error
        }
    }

    // Delete a relationship between records
    const deleteRelationship = async (datasetId, sourceRecordId, targetRecordId, relationshipType) => {
        try {
            const endpoint = `${site.api2Url}/metadata/records/${sourceRecordId}/relationships/${targetRecordId}`
            const token = await useGetToken()
            const queryParams = toQueryParams({ dataset_id: datasetId })
            const url = `${endpoint}?${queryParams}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            myHeaders.append('Content-Type', 'application/json')
            
            const resp = await fetch(url, {
                method: 'DELETE',
                headers: myHeaders,
                body: JSON.stringify({
                    relationship_type: relationshipType
                })
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to delete relationship: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error deleting relationship:', error)
            throw error
        }
    }

    // Delete (archive) a record
    const deleteRecord = async (datasetId, modelId, recordId) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records/${recordId}`
            const token = await useGetToken()
            const queryParams = toQueryParams({ 
                dataset_id: datasetId,
                force: true 
            })
            const url = `${endpoint}?${queryParams}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            
            const resp = await fetch(url, {
                method: 'DELETE',
                headers: myHeaders
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to delete record: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error deleting record:', error)
            throw error
        }
    }

    // Archive all records for a model
    const archiveAllRecords = async (datasetId, modelId, version = null) => {
        try {
            const endpoint = `${site.api2Url}/metadata/models/${modelId}/records`
            const token = await useGetToken()
            
            const queryParams = {
                dataset_id: datasetId
            }
            
            // Only add version if specified (for specific version archival)
            if (version !== null) {
                queryParams.version = version
            }
            
            const url = `${endpoint}?${toQueryParams(queryParams)}`
            
            const myHeaders = new Headers()
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            
            const resp = await fetch(url, {
                method: 'DELETE',
                headers: myHeaders
            })
            
            if (resp.ok) {
                return await resp.json()
            } else {
                const errorText = await resp.text()
                throw new Error(`Failed to archive all records: ${resp.status} - ${errorText}`)
            }
        } catch (error) {
            console.error('Error archiving all records:', error)
            throw error
        }
    }

    return {
        // State
        models,
        currentDatasetID,
        modelsLoaded,
        templates,
        templatesLoaded,
        recordFilterParams,
        activeRelationshipCreation,
        activePackageAttachment,

        // Getters
        modelById,
        templateById,

        // Actions
        fetchModels,
        fetchModelVersion,
        fetchModelVersions,
        fetchTemplates,
        fetchTemplateVersions,
        fetchRecords,
        fetchRecord,
        createRecord,
        updateRecord,
        createRelationship,
        searchRecords,
        createModel,
        createModels,
        createModelFromTemplate,
        createModelsFromTemplates,
        createTemplateFromModel,
        createTemplateVersion,
        updateVersion,
        updateModelMetadata,
        attachPackageToRecord,
        
        // Relationship creation actions
        startRelationshipCreation,
        cancelRelationshipCreation,
        completeRelationshipCreation,
        
        // Package attachment actions
        startPackageAttachment,
        cancelPackageAttachment,
        completePackageAttachment,
        fetchRecordPackages,
        fetchRecordRelationships,
        deletePackageFromRecord,
        deleteRelationship,
        deleteRecord,
        archiveAllRecords


    }

})