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
    const getInitial = cmp.vm.getInitial;
    const profile = cmp.vm.profile;

    const initial = getInitial('firstName', profile);
    expect(initial).toBe('J');
  })
})