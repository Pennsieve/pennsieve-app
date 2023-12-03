import BfEmptyPageState from './BfEmptyPageState.vue'
import { shallowMount } from '@vue/test-utils'

describe('bf-dialog.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(BfEmptyPageState, {
      slots: {
        default: '<div class="test">Test</div>'
      }
    })
  })

  it('Has slot', () => {
    cmp.vm.$nextTick(() => {
      const hasTestContent = cmp.find('.test') ? true : false;
      expect(hasTestContent).toBe(true)
    })
  })
})
