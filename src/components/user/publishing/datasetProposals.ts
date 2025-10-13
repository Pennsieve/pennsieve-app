import { defineStore } from 'pinia'
import { useMainStore } from '.'
import { defaultTo, find, propEq } from 'ramda'

const sortRepositories = (repositories: any[]):any[] =>  {
    return repositories.sort((a, b) => a.displayName.localeCompare(b.name, 'en', { numeric: true}))
}

const getOwnerName = (profile: {firstName:string, lastName:string}) => {
    let firstName = profile.firstName
    let lastName = profile.lastName
    let ownerName = `${firstName} ${lastName}`
    return ownerName
}

const transformProposalIn = (proposal:any, count = 0) => {
    return {
      'id': count,
      ...proposal
    }
}

const transformProposalOut = (proposal:any, profile:any) => {
    return {
      userId: profile.intId,
      ownerName: getOwnerName(profile),
      ...proposal
    }
  }

export const useProposalStore = defineStore('proposal', {

    state: () => ({
    
        publishingInfo: [] as any[],
        repositories: [] as any[],
        datasetProposals: [] as any[],
        repositoryModalVisible: false,
        requestModalVisible: false,
        shouldCollapsePrimaryNav: false,
        repositoryDescription: '**This is a sample repository**',
        isLoadingRepositoryDescription: false,
        selectedRepoForRequest: {},
        selectedDatasetProposal: {},
    }),
    getters: {
        getMainStore: state => () => {
            return useMainStore()
        },
        getPublishingInfo: state => (tag: string) => {
            return defaultTo({}, find(propEq('tag', tag), state.publishingInfo))
        },
        getRepositoryByNodeId: state => (nodeId: string) => {
            return state.repositories.filter(o => o.organizationNodeId == nodeId)[0]
        },
        getProposalByNodeId: state => (nodeId: string) => {
            return state.datasetProposals.filter(o => o.nodeId == nodeId)[0]
            return defaultTo({}, find(propEq('nodeId', nodeId), state.datasetProposals))
        },
    },
    actions: {
        hasProposals() {
            return this.datasetProposals.length > 0
        },
        async fetchPublishingInfo() {
            try {
                const BASE_URL = useRuntimeConfig().public.api2_host;
                let url = `${BASE_URL}/publishing/info`
                const apiKey = await useGetToken()
            
                const myHeaders = new Headers();
                myHeaders.append('Authorization', 'Bearer ' + apiKey)
                myHeaders.append('Accept', 'application/json')
                const response = await fetch(url, { headers: myHeaders })
                if (response.ok) {
                    const responseJson = await response.json()
                    let count = 0
                    let publishingInfo = responseJson.map((r: any) => {
                    return {
                        'id': ++count,
                        ...r
                    } })

                    this.publishingInfo = publishingInfo

                } else {
                    this.publishingInfo = []
                    throw new Error(response.statusText)
                }
            }
            catch (err) {
                this.publishingInfo = []
                throw new Error("unable to fetch publishing information")
            }
        },
        async fetchRepositories() {
            try {
                const BASE_URL = useRuntimeConfig().public.api2_host;
                let url = `${BASE_URL}/publishing/repositories`
                const apiKey = await useGetToken()
                const myHeaders = new Headers();
                myHeaders.append('Authorization', 'Bearer ' + apiKey)
                myHeaders.append('Accept', 'application/json')
                const response = await fetch(url, { headers: myHeaders })
                if (response.ok) {
                    const responseJson = await response.json()
                    let count = 0

                    let repositories: any[] = responseJson.map((r: { type: string; }) => {
                    return {
                        'id': ++count,
                        'isPublic': r.type === "PUBLIC",
                        ...r
                    } })

                    this.repositories = sortRepositories(repositories)

                } else {
                    this.repositories = []
                    throw new Error(response.statusText)
                }
            }
            catch (err) {
                this.repositories = []
            }
        },
        async fetchProposals() {
            try {
              const BASE_URL = useRuntimeConfig().public.api2_host;
              let url = `${BASE_URL}/publishing/proposal`
              const apiKey = await useGetToken()
              const myHeaders = new Headers();
              myHeaders.append('Authorization', 'Bearer ' + apiKey)
              myHeaders.append('Accept', 'application/json')
              const response = await fetch(url, { headers: myHeaders })
              if (response.ok) {
                const responseJson = await response.json()
                let count = 0
                let proposals = responseJson.map((p: any) => {
                  return transformProposalIn(p, ++count)
                })
                this.datasetProposals = proposals

              } else {
                this.datasetProposals = []
                throw new Error(response.statusText)
              }
            }
            catch (err) {
                this.datasetProposals = []
            }
        },
        async storeNewProposal(proposal:any) {
            // call: POST /publishing/proposal
            const BASE_URL = useRuntimeConfig().public.api2_host;
            let url = `${BASE_URL}/publishing/proposal`
            const apiKey = await useGetToken()
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')
            const response = await fetch(url, {
              method: "POST",
              headers: myHeaders,
              body: JSON.stringify(transformProposalOut(proposal, this.getMainStore().profile))
            })
            if (response.ok) {
              // get the response
              const responseJson = await response.json()
              // unpack the response
              let count = this.datasetProposals.length
              let proposal:any = transformProposalIn(responseJson, ++count)
              // mutate state

              this.datasetProposals.push(proposal)

              return {
                status: "SUCCESS",
                result: proposal
              }
            } else {
              throw new Error(response.statusText)
            }
        },

    }



})
