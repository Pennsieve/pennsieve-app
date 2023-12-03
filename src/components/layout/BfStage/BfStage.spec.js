import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BfStage from './BfStage.vue'
import EventBus from '../../../utils/event-bus'

describe('BfStage.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = mount(BfStage, {
      attachToDocument: true
    })
  })

  it('Supports stage-scroll custom event', (done) => {
    const evt = {
      target: {
        position: 50
      }
    }
    EventBus.$on('stage-scroll', (payload) => new Promise(done => {
      expect(payload).toMatchObject(evt)
      done()
    }))
    cmp.vm.onScroll(evt)
  })

  it('Removes event listener when destroyed', () => {
    const spy = vi.spyOn(cmp.vm.$el, 'removeEventListener')
    cmp.unmount()
    expect(spy).toBeCalled()
  })
})