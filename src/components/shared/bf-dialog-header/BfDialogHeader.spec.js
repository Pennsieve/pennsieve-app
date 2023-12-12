import BfDialogHeaderTestComponent from './BfDialogHeaderTestComponent.vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('BfDialogHeader.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = mount(BfDialogHeaderTestComponent, {
    })
  })

  it('Parent handles close event', () => {
    const spy = vi.spyOn(cmp.vm, 'handleClose')
    cmp.vm.$refs.dialog.onClose()
    expect(spy).toBeCalled()
  })

})
