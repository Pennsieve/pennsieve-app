import CopyConceptId from './CopyConceptId.vue'
import { shallowMount } from '@vue/test-utils'

describe('CopyConceptId.vue', () => {
  let cmp

  beforeEach(async () => {
    cmp = shallowMount(CopyConceptId)
    await cmp.setProps({
      conceptId: 'abc-123'
    })
  })

  // it('copyId()', () => {
  //   cmp.vm.$clipboard = vi.fn(() => {})
  //   const spy = vi.spyOn(cmp.vm, 'displayMessage')
  //   cmp.vm.copyId()
  //   // expect(cmp.vm.$clipboard).toBeCalled()
  //   // expect(spy).toBeCalled()
  // })

  it('displayMessage()', (done) => {
    cmp.vm.displayMessage()
    expect(cmp.vm.visibility).toBe(true)
    setTimeout(() => {
      expect(cmp.vm.visibility).toBe(false)
      done()
    }, 2250)
  })
})
