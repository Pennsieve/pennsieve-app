import Vuex from 'vuex'
import { mount } from '@vue/test-utils'

import { actions, mutations, getters } from 'vuex'
import Team from './Team.vue'
import EventBus from '../../../utils/event-bus'

const $router = {
  push: vi.fn(() => {})
}

describe('Team.vue', () => {
  let cmp
  let store
  let state, getters

  beforeEach(() => {
    state = {
      config: {
        apiUrl: 'https://app.blackfynn.net'
      },
      userToken: '123',
      activeOrganization: {
        organization: {
          name: 'Blackfynn',
          id: 666
        }
      }
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    getters =  {
      userToken: (state) => state.userToken,
      concepts: (state) => state.concepts,
    }
    cmp = mount(Team, {
      attachToDocument: true,
      global:{
        mocks: {
          $router
        },
        plugins:[store],
        stubs: ["router-link"]
      },

    })
    cmp.setProps({
      item: {
        team: {
          id: 1,
          name: 'Iggles'
        },
        memberCount: 11
      }
    })
  })

  afterEach(() => {
    EventBus.$off()
  })

  it('memberCount: singular', async () => {
    await cmp.setProps({
      item: {
        team: {
          id: 1,
          name: 'Iggles'
        },
        memberCount: 1
      }
    })
    expect(cmp.vm.memberCount).toBe('1 Member')
  })

  it('memberCount: plural', () => {
    expect(cmp.vm.memberCount).toBe('11 Members')
  })

  it('createTeamId', () => {
    const ref = cmp.vm
    const id = cmp.vm.createTeamId(cmp.vm.item)
    expect(id).toBe(1)
  })

  it('changeRoute', () => {
    const spy = vi.spyOn(cmp.vm.$router, 'push')
    cmp.vm.changeRoute(cmp.vm.item)
    expect(spy).toBeCalled()
  })

  it('openDeleteDialog', (done) => {
    const team = {
      team: {
        id: 1,
        name: 'Iggles'
      }
    }
    EventBus.$on('open-remove-team', data => {
      expect(data).toMatchObject(team)
    })
    cmp.vm.openDeleteDialog(team)
  })

  it('onTeamMenu: valid function', () => {
    const spy = vi.spyOn(cmp.vm, 'openDeleteDialog')
    cmp.vm.onTeamMenu('openDeleteDialog')
    expect(spy).toBeCalled()
  })

  it('onTeamMenu: invalid function', () => {
    const spy = vi.spyOn(cmp.vm, 'openDeleteDialog')
    cmp.vm.onTeamMenu('openDeleteDialog2')
    expect(spy).not.toBeCalled()
  })
})
