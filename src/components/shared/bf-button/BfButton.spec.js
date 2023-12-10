import BfButton from './BfButton.vue'
import { shallowMount } from '@vue/test-utils'

describe('BfButton.vue', () => {

  const cmp = shallowMount(BfButton, {
    slots: {
      default: '<div />'
    }
  })

  it('click event emits', async (done) => {
    cmp.setProps({
      disabled: false
    })
    await cmp.trigger('click')
    expect(cmp.emitted('click')).toBeTruthy()
  })
})
