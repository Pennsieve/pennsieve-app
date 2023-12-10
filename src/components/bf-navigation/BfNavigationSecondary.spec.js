import Vuex from 'vuex'
import BfNavigationSecondary from './BfNavigationSecondary.vue'
import { shallowMount } from '@vue/test-utils'
import { actions, mutations, getters, state } from '../../store'

describe('BfNavigationSecondary.vue', () => {
  let cmp
  let store

  beforeEach(() => {
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = shallowMount(BfNavigationSecondary, {
      global:{
        plugins:[store]
      }
    })
  })

  it('toggleMenu', () => {
    cmp.vm.toggleMenu()
    expect(cmp.vm.secondaryNavCondensed).toBe(true)
  })
})
