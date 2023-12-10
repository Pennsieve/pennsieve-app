global.localStorage = {
  setItem: (key, val) => global.localStorage[key] = val,
  getItem: (key) => global.localStorage[key],
  removeItem: (key) => delete global.localStorage[key]
}

import Vuex from 'vuex'
import { shallowMount } from '@vue/test-utils'
import ConceptsList from './ConceptsList.vue'
import { actions, mutations, getters } from '../../../../store'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'


describe('ConceptsList.vue', () => {
  let cmp
  let store, state

  beforeEach(() => {

    state = {
      config: {
        apiUrl: 'https://api.blackfynn.net'
      },
      userToken: '123',
      concepts: [],
    }

    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = shallowMount(ConceptsList, {
      global: {
        plugins:[store]
      }
    })
  })

  it('getDisplayOwnerMessage: displayOwnerMessage', () => {
    cmp.vm.$store.state.concepts = []
    expect(cmp.vm.displayOwnerMessage).toBe(true)
  })
})
