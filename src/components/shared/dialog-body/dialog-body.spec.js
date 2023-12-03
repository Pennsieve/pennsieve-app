import DialogBody from './DialogBody.vue'
import { mount,shallowMount } from '@vue/test-utils'

describe('DialogBody.vue', () => {
  let cmp
  let cmpEmpty

  beforeEach(() => {
    cmp = mount(DialogBody, {
      slots: {
        icon: '<div class="icon" />',
        heading: '<div class="heading" />',
        default: '<div class="default" />'
      }
    })
    cmpEmpty = shallowMount(DialogBody)
  })

  it('Has slots', () => {
    const cmp = mount(DialogBody, {
      slots: {
        icon: '<div class="icon" />',
        heading: '<div class="heading" />',
        default: '<div class="default" />'
      }
    })
    expect( (typeof cmp.vm.$slots.icon == 'function') ).toBe(true)
    expect( (typeof cmp.vm.$slots.heading == 'function') ).toBe(true)

  })

  it('Does not have slots', () => {
    expect( (typeof cmpEmpty.vm.$slots.icon == 'function') ).toBe(false)
    expect( (typeof cmpEmpty.vm.$slots.icon == 'function') ).toBe(false)
  })
})
