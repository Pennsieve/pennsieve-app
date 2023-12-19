import EnumList from './EnumList.vue'
import { shallowMount } from '@vue/test-utils'

const evt = {
  preventDefault: () => {}
}

describe('EnumList.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(EnumList)
  })

  it('addItem', () => {
    expect(cmp.vm.itemList.length).toBe(0)

    cmp.vm.newItem = 'Test'
    expect(cmp.vm.newItem.length).toBeGreaterThan(0)

    cmp.vm.addItem(evt)
    expect(cmp.vm.itemList.length).toBe(1)
    expect(cmp.vm.newItem.length).toBe(0)
  })

  it('onRemoveItemFromList', async () => {
    await cmp.setProps({
      savedList: ['A', 'B', 'C']
    })
    expect(cmp.vm.itemList.length).toBe(3)

    cmp.vm.onRemoveItemFromList('B')
    expect(cmp.vm.itemList.length).toBe(2)
  })
})