import EnumItem from './EnumItem.vue'
import { shallowMount } from '@vue/test-utils'

const evt = {
  preventDefault: () => {}
}

describe('EnumItem.vue', () => {
  let cmp

  beforeEach(async () => {
    cmp = shallowMount(EnumItem)
    await cmp.setProps({
      item: 'Jawn #1'
    })
  })

  it('Computes item name', () => {
    expect(cmp.vm.item).toBe('Jawn #1')
  })

  it('deleteItem', (done) => {
    const spy = vi.spyOn(evt, 'preventDefault')
    cmp.vm.deleteItem(evt, 'Jawn')

    const removeItem = cmp.emitted('remove-item-from-list')
    expect(removeItem[0]).toStrictEqual(['Jawn'])

  })
})