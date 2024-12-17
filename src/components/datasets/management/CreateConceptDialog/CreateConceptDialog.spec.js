
import Vuex from 'vuex'
import { mount } from '@vue/test-utils'
import CreateConceptDialog from './CreateConceptDialog.vue'
import { state, actions, mutations, getters } from 'vuex'
import EventBus from '../../../../utils/event-bus'
import flushPromises from 'flush-promises'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const $router = {
  replace: vi.fn(() => {})
}

const $route = {
  name: 'graph-management',
  params:{
    orgId: 'N:organization:c905919f-56f5-43ae-9c2a-8d5d542c133b',
    datasetId: 'N:dataset:da550e12-1023-4306-9ced-d4b27f46d019'
  }
}

describe('CreateConceptDialog.vue', () => {
  let cmp
  let store

  const concept = {
    name: "My Concept",
    displayName: "my concept",
    description: '',
    locked: false
  }

  beforeEach(() => {

    store = new Vuex.Store({
      mutations,
      getters,
      actions
    })
    cmp = mount(CreateConceptDialog, {
      global: {
        mocks: {
          $route,
          $router
        },
        plugins: [store]
      },
      attachTo: document.getElementById('app')
    })
    cmp.setData({
      concept: {
          displayName: 'my concept',
          name: 'my concept'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    EventBus.$off()
  })

  // it ('closeDialog(): close dialog resets component', () => {
  //   const visible = false
  //   cmp.setProps({
  //     visible
  //   })
  //   EventBus.$emit('update:visible')
  //   cmp.vm.$refs.conceptForm.resetFields = vi.fn(() => {})
  //   cmp.vm.closeDialog()
  //   expect(cmp.vm.$refs.conceptForm.resetFields).toBeCalled()
  // })
  //
  // it('createConcept(): create new concept on valid state', (done) => {
  //   cmp.vm.$refs.conceptForm.resetFields = vi.fn(() => {})
  //   cmp.vm.$refs.conceptForm.validate = (cb) => {
  //     return cb(true)
  //   }
  //   const spy = vi.spyOn(cmp.vm, 'handleCreateConcept')
  //   cmp.vm.createConcept()
  //   flushPromises().then(() => {
  //     expect(spy).toBeCalled()
  //     done()
  //   })
  // })
  //
  // it('createConcept(): failure', (done) => {
  //   cmp.vm.$refs.conceptForm.resetFields = jest.fn(() => {})
  //   cmp.vm.$refs.conceptForm.validate = (cb) => {
  //     return cb(true)
  //   }
  //   fetch.mockRejectOnce(JSON.stringify({message: 'Error'}), {status: 500})
  //   EventBus.$on('ajaxError', () => {
  //     done()
  //   })
  //   cmp.vm.createConcept()
  // })
  //
  // it('handleCreateConcept(): should add concept to state and send user to concept manage page',(done) => {
  //   const concept = {
  //     count: 0,
  //     createdAt: "2018-09-26T14:41:26.801Z",
  //     createdBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3",
  //     description: "",
  //     displayName: "new model",
  //     icon: null,
  //     id: "82bab5f0-05a4-4f80-85a3-74b162f7da46",
  //     locked: false,
  //     name: "new model",
  //     propertyCount: 0,
  //     templateId: null,
  //     updatedAt: "2018-09-26T14:41:26.801Z",
  //     updatedBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3"
  //   }
  //   const dialogSpy = vi.spyOn(cmp.vm, 'closeDialog')
  //   const routerSpy = vi.spyOn(cmp.vm.$router, 'replace')
  //   cmp.vm.$refs.conceptForm.resetFields = vi.fn(() => {})
  //   cmp.vm.handleCreateConcept(concept)
  //   flushPromises().then(() => {
  //     expect(routerSpy).toBeCalled()
  //     expect(dialogSpy).toBeCalled()
  //     done()
  //   })

  // })

  it('name(): returns a snakeCase version of the model display name', () => {
    const snakeCaseName = 'my_concept'
    expect(cmp.vm.name).toEqual(snakeCaseName)
  })

})