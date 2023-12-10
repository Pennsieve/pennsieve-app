import Vuex from 'vuex'
import { mount } from '@vue/test-utils'

import TeamMember from './TeamMember.vue'
import EventBus from '../../../utils/event-bus'
import { actions, mutations, getters } from '../../../store'

describe('TeamMember.vue', () => {
  let cmp
  let state
  let store

  beforeEach(() => {
    state = {
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
        organization: {
          id: 1,
          name: 'Blackfynn'
        },
        isAdmin: true,
        isOwner: false
      }
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = mount(TeamMember, {
      attachToDocument: true,
      global: {
        plugins:[store]
      }
    })
  })

  it('hasAdminRights', () => {
    expect(cmp.vm.hasAdminRights).toBe(true)
  })


  it('openDeleteMember(): remove collaborator', (done) => {
    EventBus.$on('open-remove-collaborator', () => {
      done()
    })
    cmp.vm.openDeleteMember()
  })
})
