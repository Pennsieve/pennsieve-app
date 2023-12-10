import { shallowMount } from '@vue/test-utils'
import Avatar from './Avatar.vue'
import Vuex from 'vuex'
import { getters } from '../../../store'


describe('Avatar.vue', () => {
  let cmp
  let store

  beforeEach(() => {
    const state = {
      profile: {
        firstName: 'Jason',
        lastName: 'Kelce'
      }
    }
    store = new Vuex.Store({
      state,
      getters
    })
    cmp = shallowMount(Avatar, {
      global:{
        plugins:[store]
      }
    })
  })

  it('calculates initial', () => {
    const initial = cmp.vm.getInitial('firstName', cmp.vm.$store.state.profile)
    expect(initial).toBe('J')
  })
})