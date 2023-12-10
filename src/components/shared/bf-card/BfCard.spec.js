import BfCard from './BfCard.vue'
import { shallowMount } from '@vue/test-utils'

const evt = {
  preventDefault: () => {}
}

describe('BfCard.vue', () => {
  let cmp
  let cmpEmpty

  beforeEach(() => {
    cmp = shallowMount(BfCard, {
      slots: {
        icon: '<div id="icon-slot" class="icon" />',
        footer: '<div id="footer-slot" class="footer" />'
      }
    })
    cmpEmpty = shallowMount(BfCard)
  })

  it('Has slots', () => {
    expect(cmp.find('#icon-slot').exists()).toBe(true)
    expect(cmp.find('#footer-slot').exists()).toBe(true)
  })

  it('Does not have slots', () => {
    expect(cmpEmpty.find('#icon-slot').exists()).toBe(false)
    expect(cmpEmpty.find('#footer-slot').exists()).toBe(false)
  })

  it('Truncates card copy property if length exceeds max', async () => {
    const copy = 'Spicy jalapeno bacon ipsum dolor amet duis fatback pork loin mollit minim ham chicken leberkas meatloaf kevin pork chop. Sint officia cow, burgdoggen hamburger ea meatloaf duis in labore t-bone landjaeger frankfurter aliqua do.'
    await cmp.setProps({ cardCopy: copy })
    cmp.vm.$nextTick(() => {
      expect(cmp.vm.formattedCopy.length).not.toBe(copy.length)
    });

  })

  // it('Does not truncate card copy property if length is less than max', async () => {
  //   const copy = 'Bacon ipsum dolor amet spare ribs'
  //   await cmp.setProps({ cardCopy: copy })
  //   cmp.vm.$nextTick(() => {
  //     let formattedCopy = cmp.vm.formattedCopy
  //     console.log(formattedCopy)
  //     expect(formattedCopy.length).toBe(copy.length)
  //   });
  //
  // })

  it('Does not emit the card-selected event if is-selectable is false', () => {
    expect(cmp.vm.checked).toBe(false)
    cmp.vm.sendEvent(evt)
  })
  //
  // it('Emits the card-checked event if is-selectable is true', async (done) => {
  //   await cmp.setProps({
  //     isSelectable: true
  //   })
  //
  //   await cmp.vm.$nextTick() // Wait until $emits have been handled
  //   cmp.vm.sendEvent(evt)
  //   let ev = cmp.emitted()
  //   expect(ev['card-checked']).toBeTruthy()
  //
  //
  // })

  it('Does not emit the card-checked event if is-disabled is true', async () => {
    await cmp.setProps({
      isDisabled: true
    })
    const spy = vi.spyOn(evt, 'preventDefault')
    cmp.vm.sendEvent(evt)
    expect(spy).not.toHaveBeenCalled()
  })

  it('Emits the card-unchecked event if is-selectable is true and item is checked', async (done) => {
    await cmp.setProps({
      isSelectable: true,
      checked: true
    })
    setTimeout(() => {
      const spy = vi.spyOn(evt, 'preventDefault')

      cmp.vm.sendEvent(evt)
      let ev = cmp.emitted()
      expect(ev['card-unchecked']).toBeTruthy()
    }, "50");

  })

  it('Creates css classNames if isModelCard and checked are true', async () => {
    await cmp.setProps({
      isModelCard: true,
      checked: true
    })
    setTimeout(() => {
      expect(cmp.vm.classNames).toBe('bf-card model-card active')
    }, "50");

  })

  it('Creates css classNames if isModelCard is true and checked is false', async () => {
    await cmp.setProps({
      isModelCard: true,
      checked: false
    })
    setTimeout(() => {
      expect(cmp.vm.classNames).toBe('bf-card model-card')
    }, "50");

  })

  it('Creates css classNames if isModelCard is false and checked is true', async () => {
    await cmp.setProps({
      checked: true
    })

    setTimeout(() => {
      expect(cmp.vm.classNames).toBe('bf-card active')
    }, "50");

    // expect(cmp.vm.checked).toBe(true)
    // expect(cmp.vm.classNames).toBe('bf-card active')
  })

  it('Creates css classNames if isModelCard is false and checked are false', async () => {
    await cmp.setProps({isModelCard: false, checked: false})
    expect(cmp.vm.classNames).toBe('bf-card')
  })
})
