import CharacterCountInput from './CharacterCountInput.vue'
import { shallowMount } from '@vue/test-utils'

describe('CharacterCountInput.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(CharacterCountInput)
  })

  it('warningMessage: plural', () => {
    cmp.vm.userInput = 'Spicy jalapeno bacon ipsum dolor amet tail biltong jerky drumstick'
    expect(cmp.vm.warningMessage).toBe('189 characters left')
  })

  it('warningMessage: plural', () => {
    cmp.vm.userInput = 'Spicy jalapeno bacon ipsum dolor amet tail biltong jerky drumstick landjaeger ham, salami flank buffalo kevin leberkas pork jowl tongue cow. Filet mignon pork tail short loin beef venison. Pork turkey bacon, ham salami brisket pork loin tail kevin jerky v'
    expect(cmp.vm.warningMessage).toBe('0 characters left')
  })

})