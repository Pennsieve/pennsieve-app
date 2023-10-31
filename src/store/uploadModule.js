import Cookies from "js-cookie";
import toQueryParams from '../utils/toQueryParams.js'

const initialState = () => ({
})

export const state = initialState()

export const mutations = {

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
            console.log(permanent)
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

}

export const getters = {}

const uploadsModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}

export default uploadsModule
