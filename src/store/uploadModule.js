import Cookies from "js-cookie";
import toQueryParams from '../utils/toQueryParams.js'
import {defaultTo, find, propEq} from "ramda";

const initialState = () => ({
    cognitoConfig: {},
    uploadManifestID: "",
    manifestFiles: [],
    destinationPackageId: ''
})

export const state = initialState()

export const mutations = {
    SET_COGNITO_CONFIG(state, config) {
        state.cognitoConfig = config
    },
    ADD_FILES_TO_MANIFEST(state, files) {
        state.manifestFiles.push(...files)
    },
    SET_DESTINATION_PACKAGE_ID(state, id) {
        state.destinationPackageId = id
    }
}

export const actions = {

    fetchManifestDownloadUrl: async({ commit, rootState}, manifest_id) => {
        try {
            let endpoint = `${rootState.config.api2Url}/manifest/archive`
            const apiKey = rootState.userToken || Cookies.get('user_token')

            const queryParams = toQueryParams({
                manifest_id: manifest_id,
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                return Promise.reject(resp)
            }
        } catch (err) {
            return Promise.reject(err)
        }
    },

    archiveManifest: async({ commit, rootState}, {manifest_id, permanent}) => {
        try {
            let endpoint = `${rootState.config.api2Url}/manifest/archive`
            const apiKey = rootState.userToken || Cookies.get('user_token')

            const queryParams = toQueryParams({
                manifest_id: manifest_id,
                remove: permanent
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                return Promise.reject(resp)
            }
        } catch (err) {
            return Promise.reject(err)
        }
    },

    // Get AWS Credentials to upload data to the upload-bucket
    getCognitoConfig: async ({rootState, commit, getters }, evt) => {

        // Get existing state of config
        const curCognitoConfig = getters.getCognitoConfig()

        // Check if existing state is empty
        const isEmptyConfig = Object.keys(curCognitoConfig).length === 0 &&
            curCognitoConfig.constructor === Object

        // If empty, use API to get config
        if (isEmptyConfig) {
            const endpoint = `${rootState.config.apiUrl}/authentication/cognito-config`

            try {
                const resp = await fetch(endpoint).then(function(response) {
                    return response.json();
                }).then(function(data) {
                    commit('SET_COGNITO_CONFIG', data)
                });
            } catch(e) {
                throw new Error("Unable to get cognito-config.")
            }

        }

        // Return updated config
        return getters.getCognitoConfig()
    },

    // Add files to manifest
    addManifestFiles: async({rootState, commit }, files, path) => {
        commit('ADD_FILES_TO_MANIFEST', files)

    },

    // Define the packageId where files should be uploaded
    // This can be a folder-package-id or a dataset-package-id
    setUploadDestination: async({rootState, commit}, destination_package_id) => {
        commit('SET_DESTINATION_PACKAGE_ID', destination_package_id)
    }

}

export const getters = {
    getManifestFiles: state => () => {
        return state.manifestFiles
    },
    getCognitoConfig: state => () => {
        return state.cognitoConfig

    }
}

const uploadModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}

export default uploadModule
