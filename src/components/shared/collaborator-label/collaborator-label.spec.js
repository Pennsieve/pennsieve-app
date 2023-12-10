import CollaboratorLabel from './CollaboratorLabel.vue'
import { shallowMount } from '@vue/test-utils'

describe('CollaboratorLabel.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(CollaboratorLabel)
  })

  it('isTeam: true', async () => {
    const item = {
      team: {
        id: 123,
        name: 'Blackfynn'
      }
    }
    await cmp.setProps({
      item
    })
    expect(cmp.vm.isTeam).toBe(true)
  })

  it('isTeam: false', async () => {
    const item = {}
    await cmp.setProps({
      item
    })
    expect(cmp.vm.isTeam).toBe(false)
  })

})
