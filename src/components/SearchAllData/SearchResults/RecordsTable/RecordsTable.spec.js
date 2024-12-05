import RecordsTable from './RecordsTable.vue'
import { mount } from '@vue/test-utils'
global.requestAnimationFrame = function () {}



describe('RecordsTable.vue', () => {
  let cmp

  beforeEach( () => {
    cmp = mount(RecordsTable)
  })

  it('Sets the new sort order and property', () => {
    // TODO add test logic when sorting works
  })

  it('[searchAllDataMenu: true', async () => {
    const searchAllDataMenu = true
    await cmp.setProps({
      searchAllDataMenu
    })
    expect(cmp.vm.searchAllDataMenu).toBe(true)
  })

  it('searchAllDataRecords: true', async () => {
    const searchAllDataRecords = true
    await cmp.setProps({
      searchAllDataRecords
    })
    expect(cmp.vm.searchAllDataRecords).toBe(true)
  })

  it('has table headings', async () => {
    const headings = [
      {
        name: 'heading1'
      },
      {
        name: 'heading2'
      },
      {
        name: 'heading3'
      }
    ]
    await cmp.setProps({
      headings
    })
    expect(cmp.vm.headings).toStrictEqual(headings)
  })

  /***
   * Test Scenarios:
   *
   * 1. Test that the records data exists
   * 2. Test the menu functionality for each record data
   * etc
   */

})