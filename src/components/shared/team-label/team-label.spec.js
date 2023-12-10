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
      },
      propsData: {
        showMembers: false
      }
    })
    expect(wrapper.vm.avatarClass).toBe('team-avatar condensed')
  })

  it('avatarClass: showMembers true', () => {
    const wrapper = shallowMount(TeamLabel, {
      propsData: {
        showMembers: true
      }
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
      propsData: {
        showMembers: false
      }
    })
    expect(wrapper.vm.createTeamId(team)).toBe(123)
  })

  it('createTeamId: default Id', () => {
    const team = {}
    const wrapper = shallowMount(TeamLabel, {
      propsData: {
        showMembers: false
      }
    })
    expect(wrapper.vm.createTeamId(team)).toBe('N:team:0')
  })
})
