import Vuex from 'vuex'
import { mount } from '@vue/test-utils'
import AddTeamMembers from './AddTeamMembers.vue'
import { actions, mutations, getters } from '../../../store'
import EventBus from '../../../utils/event-bus'
import flushPromises from 'flush-promises'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'


const origMembers = [
  {
    id: 1,
    firstName: 'Bruce',
    lastName: 'Wayne',
    email: 'bwayne@dc.com'
  },
  {
    id: 2,
    firstName: 'Richard',
    lastName: 'Grayson',
    email: 'rgrayson@dc.com'
  },
  {
    id: 3,
    firstName: 'Barbara',
    lastName: 'Gordon',
    email: 'bgordon@dc.com'
  }
]

describe('AddTeamMembers.vue', () => {
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
          id: 777
        }
      },
      orgMembers: origMembers
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = mount(AddTeamMembers, {
      attachToDocument: true,
      props: {
        team: {
          team: {
            id: 98,
            name: 'The Birds'
          }
        },
        members: []
      },
      global:{
        plugins:[store]
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    EventBus.$off()
  })

  it('teamName', () => {
    expect(cmp.vm.teamName).toBe('The Birds')
  })

  it('addToTeamRequest(): no selected ids', () => {
    expect(cmp.vm.addToTeamRequest()).toBe(undefined)
  })

  it('selectMember()', () => {
    cmp.vm.origMembers = origMembers
    cmp.vm.selectMember(origMembers[1])
    expect(cmp.vm.selectedMembers).toMatchObject([origMembers[1]])
  })


  it('onRemoveMemberFromList()', () => {
    cmp.vm.selectedMembers = origMembers
    cmp.vm.onRemoveMemberFromList(origMembers[2])
    expect(cmp.vm.selectedMembers).toMatchObject([origMembers[0], origMembers[1]])
  })


})
