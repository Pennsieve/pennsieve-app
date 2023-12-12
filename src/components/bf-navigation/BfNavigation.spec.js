import BfNavigation from './BfNavigation.vue'
import {shallowMount} from '@vue/test-utils'
import store from '../../store'
import { beforeEach, describe, expect, it, vi } from 'vitest'


describe('BfNavigation.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(BfNavigation, {
      global: {
        stubs: ["router-link", "router-view"],
        plugins: [store],
      },
    })
  })

  it('hasAdminRights: true', () => {
    cmp.vm.$store.state.activeOrganization.isAdmin = true
    expect(cmp.vm.hasAdminRights).toBe(true)
  })

  it('hasAdminRights: false', () => {
    cmp.vm.$store.state.activeOrganization.isAdmin = false
    expect(cmp.vm.hasAdminRights).toBe(false)
  })

  it('activeOrganizationName', () => {
    cmp.vm.$store.state.activeOrganization.organization ={name:'Blackfynn'}
    expect(cmp.vm.activeOrganizationName).toBe('Blackfynn')
  })

  it('activeOrganizationId', () => {
    cmp.vm.$store.state.activeOrganization.organization ={id:1}
    expect(cmp.vm.activeOrganizationId).toBe(1)
  })

  it('toggleMenu', () => {
    cmp.vm.toggleMenu()
    expect(cmp.vm.primaryNavCondensed).toBe(true)
    cmp.vm.toggleMenu()
    expect(cmp.vm.primaryNavCondensed).toBe(false)
  })

  it('closeMenu', async (done) => {
    cmp.vm.closeMenu()
    await cmp.vm.$nextTick(() => {
      expect(cmp.vm.$store.state.primaryNavOpen).toBe(false)
    })
  })
})
