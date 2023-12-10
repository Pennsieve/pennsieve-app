import Vuex from 'vuex'
import { mount } from '@vue/test-utils'

import OrgMember from './OrgMember.vue'
import EventBus from '../../../utils/event-bus'
import { actions, mutations, getters } from '../../../store'

describe('OrgMember.vue', () => {
  let cmp
  let state
  let store

  beforeEach(() => {
    state = {
      config: {
        apiUrl: 'https://app.pennsieve.net'
      },
      profile: {
        id: 1,
        firstName: 'Dick',
        lastName: 'Tracy',
        email: 'dtracy@detective.com'
      },
      userToken: '123',
      activeOrganization: {
        organization: {
          id: 1,
          name: 'Pennsieve'
        }
      }
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = mount(OrgMember, {
      attachToDocument: true,
      global: {
        plugins: [store]
      }
    })
  })

  afterEach(() => {
    EventBus.$off()
  })

  it('status: undefined', () => {
    cmp.setProps({
      item: {}
    })

    expect(cmp.vm.status).toBe('')
  })

  it('status: Expired', async () => {
    cmp.setProps({
      item: {
        pending: true,
        validUntil: 1519880400000
      }
    })
    await cmp.vm.$nextTick()
    expect(cmp.vm.status).toBe('Expired')
  })

  it('status: Pending', async () => {
    const dt = new Date()
    const tomorrow = dt.setDate(dt.getDate() + 1)
    cmp.setProps({
      item: {
        pending: true,
        validUntil: tomorrow
      }
    })
    await cmp.vm.$nextTick()
    expect(cmp.vm.status).toBe('Pending')
  })

  it('statusClass', async() => {
    cmp.setProps({
      item: {
        pending: true,
        validUntil: 1519880400000
      }
    })
    await cmp.vm.$nextTick()
    expect(cmp.vm.statusClass).toBe('member-status expired')
  })

  it('dataUsage', async () => {
    cmp.setProps({
      item: {
        storage: 100000,
      }
    })
    await cmp.vm.$nextTick()
    expect(cmp.vm.dataUsage).toBe('100 KB')
  })
})
