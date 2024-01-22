import Vuex from 'vuex'
import { shallowMount } from '@vue/test-utils'
import AddRelationshipDrawer from './AddRelationshipDrawer.vue'
import { actions, mutations, getters, state } from 'vuex'

describe('AddRelationshipDrawer.vue', () => {
  let cmp
  let store

  beforeEach(() => {
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })

    cmp = shallowMount(AddRelationshipDrawer, {
      global: {
        plugins: [store],
      },
    })
  })

  it('disableButton: true', () => {
    expect(cmp.vm.disableButton).toBe(true)
  })

  it('disableButton: false', () => {
    cmp.vm.selectedItemIds = new Set(['test'])

    cmp.vm.relationshipVal = 'belongs_to'

    expect(cmp.vm.disableButton).toBe(false)
  })

  it('closeSideDrawer', () => {
    cmp.vm.closeSideDrawer()
    expect(cmp.vm.visible).toBe(false)
  })

  it('closeSideDrawer', () => {
    cmp.vm.closeSideDrawer()
    expect(cmp.vm.visible).toBe(false)
  })
})
