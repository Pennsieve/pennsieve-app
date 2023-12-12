import TeamLabel from './TeamLabel.vue'
import { shallowMount } from '@vue/test-utils'


const $router = {
  push: vi.fn(() => {})
}

describe('TeamLabel.vue', () => {

  it('avatarClass: showMembers false', () => {
    const wrapper = shallowMount(TeamLabel, {
      global: {
        mocks :{
          $router
        },
        stubs: ['router-link']
      },
      props: {
        showMembers: false
      },
    })
    expect(wrapper.vm.avatarClass).toBe('team-avatar condensed')
  })

  it('avatarClass: showMembers true', () => {
    const wrapper = shallowMount(TeamLabel, {
      props: {
        showMembers: true
      },
      global:{
        stubs: ['router-link']
      },
      stubs: ['router-link']

    })
    expect(wrapper.vm.avatarClass).toBe('team-avatar')
  })

  it('createTeamId: valid Id', () => {
    const team = {
      team: {
        id: 123
      }
    }
    const wrapper = shallowMount(TeamLabel, {
      props: {
        showMembers: false
      },
      global:{
        stubs: ['router-link']
      },
    })
    expect(wrapper.vm.createTeamId(team)).toBe(123)
  })

  it('createTeamId: default Id', () => {
    const team = {}
    const wrapper = shallowMount(TeamLabel, {
      props: {
        showMembers: false
      },
      global:{
        stubs: ['router-link']
      },
    })
    expect(wrapper.vm.createTeamId(team)).toBe('N:team:0')
  })
})
