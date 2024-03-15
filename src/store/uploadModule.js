import Cookies from "js-cookie";
import toQueryParams from '../utils/toQueryParams.js'
import {compose, defaultTo, find, join, map, prepend, propEq, reverse} from "ramda";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { GetCredentialsForIdentityCommand, CognitoIdentityClient, GetIdCommand } from "@aws-sdk/client-cognito-identity";
import { Upload } from "@aws-sdk/lib-storage"
import {ChecksumAlgorithm, S3Client} from "@aws-sdk/client-s3"
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers"; // ES6 import


import {v1 as uuidv1} from "uuid";
import router from '@/router'
import EventBus from '../utils/event-bus'

class UploadFile {
    constructor(uploadId, s3Key, targetPath, targetName) {
        this.upload_id = uploadId;
        this.s3_key = s3Key;
        this.target_path = targetPath;
        this.target_name = targetName;
    }
}

const initialState = () => ({
    cognitoConfig: {},
    manifestNodeId: "",
    manifestFiles: [],
    uploadFileMap: new Map(),
    uploadDestination: '',
    identityCreds: {},
    isUploading: false,
    uploadComplete: false,
    uploadProgress: {total: 0, loaded:0}
})

export const state = initialState()

export const mutations = {
    SET_COGNITO_CONFIG(state, config) {
        state.cognitoConfig = config
    },
    ADD_FILES_TO_MANIFEST(state, files) {
        state.manifestFiles.push(...files)
    },
    REMOVE_FILE_FROM_MANIFEST(state, f) {
        const idx = find(propEq(f.id, 'id'))(state.manifestFiles)
        state.manifestFiles.splice(idx, 1);
    },
    RESET_MANIFEST_FILES(state) {
      state.manifestFiles = []
    },
    SET_UPLOAD_DESTINATION(state, obj) {
        state.uploadDestination = obj
    },
    SET_MANIFEST_NODE_ID(state, nodeId) {
        state.manifestNodeId = nodeId
    },
    SET_UPLOAD_FILE_MAP(state,uploadFileMap) {
        state.uploadFileMap = uploadFileMap
    },
    UPDATE_UPLOAD_PROGRESS(state, progressInfo) {
        let curMap = state.uploadFileMap.get(progressInfo.key)
        const diff = progressInfo.loaded - curMap.progress.loaded
        curMap.progress = {
            loaded: progressInfo.loaded,
            total: progressInfo.total
        }

        // update total progress and loaded
        state.uploadProgress.loaded += diff

    },
    SET_IS_UPLOADING(state, value) {
        state.isUploading = value
    },
    SET_UPLOAD_COMPLETE(state, value) {
        state.uploadComplete = value
    },
    RESET_UPLOADER(state) {
        state.uploadFileMap = new Map()
        state.manifestFiles = []
        state.progress = {total: 0, loaded:0}
        state.uploadDestination = ''
        state.isUploading = false
        state.uploadComplete = false
    }
}

export const actions = {

    fetchManifestDownloadUrl: async ({commit, rootState}, manifest_id) => {
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

    archiveManifest: async ({commit, rootState}, {manifest_id, permanent}) => {
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
    getCognitoConfig: async ({rootState, commit, getters}, evt) => {

        // Get existing state of config
        const curCognitoConfig = getters.getCognitoConfig()

        // Check if existing state is empty
        const isEmptyConfig = Object.keys(curCognitoConfig).length === 0 &&
            curCognitoConfig.constructor === Object

        // If empty, use API to get config
        if (isEmptyConfig) {
            const endpoint = `${rootState.config.apiUrl}/authentication/cognito-config`

            try {
                const resp = await fetch(endpoint).then(function (response) {
                    return response.json();
                }).then(function (data) {
                    commit('SET_COGNITO_CONFIG', data)
                });
            } catch (e) {
                throw new Error("Unable to get cognito-config.")
            }

        }

        // Return updated config
        return getters.getCognitoConfig()
    },

    // Add files to manifest
    addManifestFiles: async ({state, commit}, files, path) => {
        if (state.isUploading) {
            const errMsg = "Cannot add files while upload is in progress."
            Promise.reject(new Error(errMsg)).then(resolved, rejected);
        } else {
            commit('SET_UPLOAD_COMPLETE', false)
            commit('ADD_FILES_TO_MANIFEST', files)
        }
    },

    // Remove file from manifest
    removeFromManifest: async({state, commit}, files) => {
        for (let i in files) {
            commit('REMOVE_FILE_FROM_MANIFEST', files[i])
        }
    },

    // Define the packageId where files should be uploaded
    // This can be a folder-package-id or a dataset-package-id
    setUploadDestination: async ({rootState, commit}, targetPackage) => {

        // check that target location is foler
        if (!(targetPackage.content.packageType === 'Collection' || targetPackage.content.packageType === 'DataSet')) {
            const errMsg = 'Error: Trying to set target folder to a non-folder type package'
            Promise.reject(new Error(errMsg)).then(resolved, rejected);
        }

        const getFileLocation = (pkg) => {

            // target location is '' when uploading to root folder (e.g. Dataset)
            if (pkg.content.packageType === 'DataSet') {
                return ''
            }

            const ancestors = pkg.ancestors

            if (ancestors.length > 0) {
                const rootNode = ''

                let path = rootNode
                if (pkg.ancestors && ancestors.length > 0) {
                    path = compose(
                        join('/'),
                        prepend(rootNode),
                        map(ancestor => {
                            return ancestor.content.name
                        }),
                        reverse()
                    )(ancestors)
                }

                // remove initial '/' and append target-package name
                return path.slice(1) + '/' + pkg.content.name

            } else {
                return pkg.content.name
            }

        }

        let uploadDestination = {
            path: getFileLocation(targetPackage),
            file: targetPackage
        }

        commit('SET_UPLOAD_DESTINATION', uploadDestination)
    },

    // Get or Request a NodeId for a manifest.
    getManifestNodeId: async ({rootState, commit}, evt) => {

        if (state.manifestNodeId.length > 0) {
            return state.manifestNodeId
        } else {
            const endpoint = `${rootState.config.api2Url}/manifest`

            const currentRoute = router.currentRoute.value
            const datasetId = currentRoute.params.datasetId

            const apiKey = rootState.userToken || Cookies.get('user_token')
            const queryParams = toQueryParams({
                dataset_id: datasetId,
            })

            const url = `${endpoint}?${queryParams}`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')

            try {
                const resp = await fetch(url, {
                    method: "POST",
                    headers: myHeaders,
                    body: JSON.stringify({'DatasetId': datasetId})
                })
                if (resp.ok) {
                    const response = await resp.json()
                    commit('SET_MANIFEST_NODE_ID', response.manifest_node_id)
                    return response.manifest_node_id

                } else {
                    commit('SET_MANIFEST_NODE_ID', '')
                    return new Error(resp.statusText)
                }
            } catch (err) {
                EventBus.$emit('ajaxError', err)
                commit('SET_MANIFEST_NODE_ID', '')
            }
        }

    },

    // Upload files in UploadFilesMap to Pennsieve using AWS SDK
    UploadFiles: async( {rootState, state, dispatch, commit}, evt) =>{

        // Get or Fetch cognito config
        const config = await dispatch('getCognitoConfig')

        // Create logins structure
        let logins = {}
        const poolResource = "cognito-idp.us-east-1.amazonaws.com/" + config.userPool.id
        logins[poolResource] = rootState.cognitoUser.signInUserSession.idToken.jwtToken

        commit('SET_IS_UPLOADING', true)

        const currentRoute = router.currentRoute.value
        const datasetId = currentRoute.params.datasetId

        // Iterate over the file-list and upload sequentially
        // TODO: Add concurrency
        for (let [key, value] of state.uploadFileMap) {
            try {
                const tags = "OrgId=" + rootState.activeOrganization.organization.id + "&DatasetId=" + datasetId

                const parallelUploads3 = new Upload({
                    client: new S3Client({
                        region: 'us-east-1',
                        credentials: fromCognitoIdentityPool({
                            identityPoolId: config.identityPool.id,
                            clientConfig: {region: config.region},
                            cache: state.identityCreds,
                            logins: logins
                        }),
                    }),
                    queueSize: 4,
                    leavePartsOnError: false,
                    params: {
                        Bucket: rootState.config.bucketName,
                        Key: value.config.s3_key,
                        Body: value.file,
                        Tagging: tags
                    }
                })

                parallelUploads3.on("httpUploadProgress", (progress) => {
                    commit('UPDATE_UPLOAD_PROGRESS', {
                        key: progress.Key,
                        loaded: progress.loaded,
                        total: progress.total
                    })
                });

                await parallelUploads3.done();
            } catch (e) {
                console.log(e);
            }
        }
        commit('SET_UPLOAD_COMPLETE', true)
    },

    // Sync Manifest Files with Server
    syncManifest: async ({rootState,commit, dispatch}, evt) => {

        // Current assumptions:
        // 1. Uploads through browser can sync manifest in single call.
        // 3. All files are uploaded to the folder specified in 'destinationPackageId'

        //
        const endpoint = `${rootState.config.api2Url}/manifest`
        const currentRoute = router.currentRoute.value
        const datasetId = currentRoute.params.datasetId

        const apiKey = rootState.userToken || Cookies.get('user_token')
        const queryParams = toQueryParams({
            dataset_id: datasetId,
        })

        let uploadMap =  new Map()
        let requestFiles = []
        let total = 0
        for (let mf in state.manifestFiles) {

            const uploadId = uuidv1()
            const s3Key = state.manifestNodeId + '/' + uploadId

            const curFile = state.manifestFiles[mf]

            let fileLocation = state.uploadDestination.path + curFile.path.substring(0, curFile.path.length-curFile.name.length)
            fileLocation = fileLocation.replace(/^\//, '') // remove leading '/' if it exists
            fileLocation = fileLocation.replace(/\/$/, '') // remove trailing '/' if it exists

            const f = new UploadFile(
                uploadId,
                s3Key,
                fileLocation,
                curFile.name,
                curFile
            )

            uploadMap.set(s3Key, {
                file: curFile,
                config: f,
                progress: {loaded:0, total: curFile.total}
            })

            total += curFile.size

            requestFiles.push(f)
        }

        // Set the map
        commit("SET_UPLOAD_FILE_MAP", uploadMap)

        // Set the total number of bytes of all files combined
        state.uploadProgress.total = total

        let requestBody = {
            id: state.manifestNodeId,
            files: requestFiles
        };

        const url = `${endpoint}?${queryParams}`
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            }).then(function (resp) {
                console.log('Sync Successful')
            });
        } catch (e) {
            console.log(e)
            throw new Error("Unable to sync manifest.")
        }
    },

    // Reset upload action
    resetUpload: async({ commit}, evt ) => {
        commit("RESET_UPLOADER")
    }

}

export const getters = {
    getManifestFiles: state => () => {
        return state.manifestFiles
    },
    getUploadMap: state => () => {
      return state.uploadFileMap
    },
    getCognitoConfig: state => () => {
        return state.cognitoConfig
    },
    getIsUploading: state => () => {
        return state.isUploading
    },
    getUploadComplete: state => () => {
        return state.uploadComplete
    },
    getUploadProgress: state => () => {
        return state.uploadProgress
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
