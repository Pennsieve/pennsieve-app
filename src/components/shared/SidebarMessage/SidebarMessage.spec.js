import SidebarMessage from './SidebarMessage.vue'
import { shallowMount } from '@vue/test-utils'

describe('SidebarMessage.vue', () => {
  let cmp
  let cmpEmpty

  beforeEach(() => {
    cmp = shallowMount(SidebarMessage, {
      props: {
        title: 'Locked Concept'
      },
      slots: {
        copy: 'This is test copy',
        default: '<p>This is a test</p>',
      }
    })
    cmpEmpty = shallowMount(SidebarMessage)
  })

  it('Has slots', () => {
    expect(cmp.vm.title.length).not.toBe(0)
    expect(cmp.vm.$slots.copy).not.toBe(undefined)
    expect(cmp.vm.$slots.default).not.toBe(undefined)
  })

  it('Does not have slots', () => {
    expect(cmpEmpty.vm.title.length).toBe(0)
    expect(cmpEmpty.vm.$slots.copy).toBe(undefined)
    expect(cmpEmpty.vm.$slots.default).toBe(undefined)
  })
})