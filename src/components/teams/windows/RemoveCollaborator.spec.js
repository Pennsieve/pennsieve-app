import Vuex from 'vuex'
import { mount } from '@vue/test-utils'
import RemoveCollaborator from './RemoveCollaborator.vue'
import { actions, mutations, getters } from '../../../store'
import EventBus from '../../../utils/event-bus'
import flushPromises from 'flush-promises'

describe('RemoveCollaborator.vue', () => {
  let cmp
  let store
  let state

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
    cmp = mount(RemoveCollaborator, {
      attachToDocument: true,
      props: {
        team: {
          team: {
            id: 777,
            name: 'Iggles'
          }
        },
        member: {
          id: 1,
          firstName: 'Clark',
          lastName: 'Kent'
        }
      },
      global: {
        plugins: [store]
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

  it('deleteUrl', async () => {
    const expectedUrl = 'https://app.blackfynn.net/organizations/666/teams/777/members/1?api_key=undefined'
    const deleteUrl = await cmp.vm.deleteUrl()
    expect(deleteUrl).toBe(expectedUrl)
  })

  it('removeCollaborator(): success', (done) => {
    EventBus.$on('toast', payload => {
      const expectedMsg = `${cmp.vm.member.firstName} ${cmp.vm.member.lastName} removed from ${cmp.vm.team.team.name}`
      expect(payload.detail.msg).toBe(expectedMsg)
    })
    cmp.vm.removeCollaborator()
  })

  it('removeCollaborator(): failure', (done) => {
    EventBus.$on('ajaxError', () => {
    })
    cmp.vm.removeCollaborator()
  })
})
