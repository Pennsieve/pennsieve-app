import BfProgressBar from './bf-progress-bar.vue'
import { shallowMount } from '@vue/test-utils'

describe('bf-progress-bar.vue', () => {

  let cmp;

  beforeEach(() => {
    cmp = shallowMount(BfProgressBar, {
      propsData: {
        loaded: 50,
        total: 100
      }
    })
  })

  it('Computes progress', () => {
    expect(cmp.vm.progress).toEqual(50)
  })
})
