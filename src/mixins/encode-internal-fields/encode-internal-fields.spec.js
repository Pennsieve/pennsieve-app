import { shallowMount} from '@vue/test-utils'

import EncodeInternalFields from './'
import TestComponent from "../test-component.vue";

describe('EncodeInternalFields Mixin', () => {

  let cmp

  beforeEach(() => {

    cmp = shallowMount(TestComponent, {
      mixins: [EncodeInternalFields]
    })

  })

  it('prefixField: adds encoded prefix', () => {
    const field = cmp.vm.prefixField('createdAt')
    expect(field).toBe('%24createdAt')
  })

  it('prefixField: adds prefix', () => {
    const field = cmp.vm.prefixField('createdAt', false)
    expect(field).toBe('$createdAt')
  })

  it('prefixField: no prefix', () => {
    const field = cmp.vm.prefixField('myField')
    expect(field).toBe('myField')
  })
})