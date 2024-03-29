import { shallowMount} from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PasswordValidator from './'
import TestComponent from "../test-component.vue";

describe('Password Validator Mixin', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(TestComponent, {
      mixins: [PasswordValidator]
    })
  })

  it('validatePassword: needs at least 8 characters', () => {
    const pw = cmp.vm.validatePassword('w')
    expect(pw.isValid).toBe(false)
    expect(pw.feedback).toBe('Please add at least 8 characters.')
  })

  it('validatePassword: satisifies entropy requirement', () => {
    const pw = cmp.vm.validatePassword('X4EHHoTiF1ff!')
    expect(pw.feedback).toBe('Strong password!')
    expect(pw.isValid).toBe(true)
  })

  it('validatePassword: needs lower case letters', () => {
    const pw = cmp.vm.validatePassword('X4EHHTF1')
    expect(pw.feedback).toBe('Please add lower case characters.')
    expect(pw.isValid).toBe(false)
  })

  it('validatePassword: needs upper case letters', () => {
    const pw = cmp.vm.validatePassword('x4ehhtf1')
    expect(pw.feedback).toBe('Please add upper case characters.')
    expect(pw.isValid).toBe(false)
  })

  it('validatePassword: needs numbers', () => {
    const pw = cmp.vm.validatePassword('xzehHtfz')
    expect(pw.feedback).toBe('Please add numbers.')
    expect(pw.isValid).toBe(false)
  })

  it('validatePassword: needs special characters', () => {
    const pw = cmp.vm.validatePassword('xzehHtfz2')
    expect(pw.feedback).toBe('Please add special characters.')
    expect(pw.isValid).toBe(false)
  })
})