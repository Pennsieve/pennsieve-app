import {useGetToken} from "@/composables/useGetToken";

const sortIntegrations = (integrations) => {
  return integrations.sort((a, b) => a.displayName.localeCompare(b.name, 'en', { numeric: true}))
}

const initialState = () => ({
  integrations: [],
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  UPDATE_INTEGRATIONS(state, integrations) {
    state.integrations = sortIntegrations(integrations)
  },

  EDIT_INTEGRATION(state, integration) {
    const integrations = state.integrations.filter(it => it.id !== integration.id)
    integrations.push(integration)
    state.integrations = sortIntegrations(integrations)
  },

  CREATE_INTEGRATION(state, integration) {
    state.integrations.push(integration)
  },

  REMOVE_INTEGRATION(state, integrationId) {
    const integrations = state.integrations.filter(integration => integration.id !== integrationId)
    state.integrations = integrations
  },

}

export const actions = {
  updateIntegrations: ({commit}, data) => commit('UPDATE_INTEGRATIONS', data),

  fetchIntegrations: async({ commit, rootState }) => {
    try {
      useGetToken()
          .then(token => {
            const url = `${rootState.config.apiUrl}/webhooks?api_key=${token}`
            fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            })
                .then(response => {
                  response.json()
                      .then(collections => {
                        commit('UPDATE_INTEGRATIONS', collections)
                      })
                })

          })
    }
    catch(err) {
      commit('UPDATE_INTEGRATIONS', [])
      return Promise.reject(err)
    }
  },

  editIntegration: async ({commit, rootState}, integrationDTO ) => {
    try {
      useGetToken().then(token => {
        const url = `${rootState.config.apiUrl}/webhooks/${integrationDTO.id}?api_key=${token}`
        fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(integrationDTO)
        }).then(resp =>{
          if (resp.ok) {
            resp.json().then(integration =>{
              commit('EDIT_INTEGRATION', integration)
            })
          } else {
            return Promise.reject(resp)
          }
        })
      })
    }catch (err) {
      return Promise.reject(err)
    }
  },
  createIntegration: async ({ commit, rootState }, integrationDTO) => {
    try {
      const token = await useGetToken();
      
      const url = `${rootState.config.apiUrl}/webhooks?api_key=${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(integrationDTO),
      });
  
      if (!response.ok) {
        const error = await response.json();
        console.error('Error creating integration:', error);
        return Promise.reject(error);
      }
  
      const integration = await response.json();
      commit('CREATE_INTEGRATION', integration);
      return Promise.resolve(integration);
    } catch (err) {
      console.error('Error in createIntegration:', err);
      return Promise.reject(err);
    }
  },
  
  removeIntegration: async({ commit, dispatch, rootState }, integrationId) => {
    try {
      useGetToken().then(token => {
        const url = `${rootState.config.apiUrl}/webhooks/${integrationId}?api_key=${token}`
        fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(resp => {
          if (resp.ok) {
            commit('REMOVE_INTEGRATION', integrationId)
          } else {
            return Promise.reject(resp)
          }
        })
      })
    } catch (err) {
      return Promise.reject(err)
    }
  },

}

export const getters = {}

const integrationsModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default integrationsModule
