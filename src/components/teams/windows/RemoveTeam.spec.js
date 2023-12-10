import Vuex from 'vuex'
import { mount } from '@vue/test-utils'
import RemoveTeam from './RemoveTeam.vue'
import { actions, mutations, getters } from '../../../store'
import EventBus from '../../../utils/event-bus'
import flushPromises from 'flush-promises'

const $router = {
  push: vi.fn(() => {})
}

describe('RemoveTeam.vue', () => {
  let cmp
  let store
  let state
  let $route

  beforeEach(() => {
    $route = {
      name: ''
    }
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
    cmp = mount(RemoveTeam, {
      attachToDocument: true,
      global:{
        plugins:[store],
        mocks: {
          $route,
          $router
        },
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    EventBus.$off()
  })

  it('closeDialog', () => {
    cmp.vm.closeDialog()
    expect(cmp.vm.dialogVisible).toBe(false)
  })

  it('handleRemoveTeam', () => {
    const myTeam = {
      team: {
        id: 1,
        name: 'Iggles'
      }
    }
    cmp.vm.handleRemoveTeam(myTeam)
    expect(cmp.vm.team).toMatchObject(myTeam.team)
    expect(cmp.vm.dialogVisible).toBe(true)
  })

  it('deleteUrl', () => {
    cmp.vm.team = {id: 777}
    const expectedUrl = 'https://app.blackfynn.net/organizations/666/teams/777?api_key=123'
    const deleteUrl = cmp.vm.deleteUrl()
    expect(deleteUrl).toBe(expectedUrl)
  })

  it('removeTeam(): success toast', (done) => {
    cmp.vm.team = {
      id: 1,
      name: 'Iggles'
    }
    EventBus.$on('toast', payload => {
      const expectedMsg = `${cmp.vm.team.name} removed from ${cmp.vm.activeOrganization.organization.name}`
      expect(payload.detail.msg).toBe(expectedMsg)
      done()
    })
    cmp.vm.removeTeam()
  })

  // it('removeTeam(): success event emitted', (done) => {
  //   const spy = vi.spyOn(cmp.vm, 'closeDialog')
  //   cmp.vm.$on('team-removed', () => {
  //     expect(spy).toBeCalled()
  //   })
  //   cmp.vm.removeTeam()
  // })

  // it('removeTeam(): success + redirect', (done) => {
  //   cmp.vm.$route.name = 'team-members-list'
  //   const spy = vi.spyOn(cmp.vm.$router, 'push')
  //   cmp.vm.removeTeam()
  //   flushPromises().then(() => {
  //     expect(spy).toBeCalled()
  //   })
  // })

  it('removeTeam(): failure', (done) => {
    EventBus.$on('ajaxError', () => {
    })
    cmp.vm.removeTeam()
  })
})
