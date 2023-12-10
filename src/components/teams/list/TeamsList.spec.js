import Vuex from 'vuex'
import { mount } from '@vue/test-utils'

import TeamList from './TeamsList.vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'


const teams = [
  {team: {id: 1, name: 'Eagles'}},
  {team: {id: 2, name: 'Giants'}},
  {team: {id: 3, name: 'Redskins'}},
  {team: {id: 4, name: 'Cowboys'}}
]

describe('TeamList.vue', () => {
  let cmp
  let state, actions, getters, mutations

  beforeEach(() => {
    state = {
      teams,
      config: {
        apiUrl: 'https://app.blackfynn.net'
      },
      profile: {
        id: 1,
        firstName: 'Clarke',
        lastName: 'Kent'
      },
      userToken: '123',
      activeOrganization: {
        isAdmin: true,
        organization: {
          name: 'Blackfynn',
          id: 777
        },
        administrators: [{id: 1}]
      },
    }

    mutations = {
      UPDATE_TEAMS(state, teams) {
        state.teams = teams;
      },
    }

    actions = {
      updateTeams: ({ commit }, evt) => commit("UPDATE_TEAMS", evt),
    }

    getters = {
      activeOrganization: (state) => state.activeOrganization,
    }

    let store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = mount(TeamList, {
      global: {
        plugins: [store],
        stubs: ["router-link", "router-view"]
      },
      attachToDocument: true,
    })


  })

  it('watch teams', async (done) =>  {
    const spy = vi.spyOn(cmp.vm, 'getTeams')
    cmp.vm.teamsList = []
    await cmp.vm.$store.dispatch('updateTeams', [{team: {id: 1, name: 'Eagles'}},]).then(() => {
      const updatedTeams = cmp.vm.teams
      expect(spy).toBeCalled()
    })
  })

  it('orgName', () => {
    expect(cmp.vm.orgName).toBe('Blackfynn')
  })

  it('hasAdminRights: $state ready', () => {
    expect(cmp.vm.hasAdminRights).toBe(true)
  })

  it('isEmpty', () => {
    expect(cmp.vm.isEmpty).toBe(false)
  })

  it('onTeamRemoved(): failure', () => {
    const team = {}
    cmp.vm.onTeamRemoved(team)
    expect(cmp.vm.teams.length).toBe(4)
  })

  it('onTeamRemoved(): success', () => {
    const team = cmp.vm.teams[0]
    cmp.vm.onTeamRemoved(team)
    expect(cmp.vm.teams.length).toBe(3)
  })

  it('onTeamCreated(): same team', () => {
    const team = cmp.vm.teams[0]
    expect(cmp.vm.teams.length).toBe(4)
    cmp.vm.onTeamCreated(team)
    expect(cmp.vm.teams.length).toBe(4)
  })

  it('onTeamCreated(): success', async () => {
    const team = {
      team: {
        id: 5,
        name: 'Steelers'
      }
    }
    expect(cmp.vm.teams.length).toBe(4)
    cmp.vm.onTeamCreated(team)
    await cmp.vm.$nextTick()
    expect(cmp.vm.teams.length).toBe(5)
  })

  it('getTeams(): success', () => {
    expect(cmp.vm.teams.length > 0).toBe(true)
  })

  it('sortColumn', async () => {
    cmp.vm.sortColumn('team.id')
    const sortedTeams = cmp.vm.returnSort('team.id', teams, 'asc')
    await cmp.vm.$nextTick()

    expect(cmp.vm.teams).toMatchObject(sortedTeams)
  })

  it('openCreateDialog()', async () => {
    cmp.vm.openCreateDialog()
    await cmp.vm.$nextTick()
    expect(cmp.vm.$refs.createEditTeam.dialogVisible).toBe(true)
  })
})
