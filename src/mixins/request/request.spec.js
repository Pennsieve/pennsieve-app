import  {shallowMount, mount} from '@vue/test-utils'
import EventBus from '../../utils/event-bus'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { HttpResponse, http } from 'msw'
import { createStore } from 'vuex'

const store = createStore({
  state() {
    return {
    }
  },
  actions: {
    clearState: ({commit}) => {
    }
  }
})

import request from './'
import TestComponent from "../test-component.vue";

describe('request Mixin', () => {
  let cmp
  let $router
  let $route

  beforeEach(() => {
    $route = {
      matched: []
    }
    $router = {
      replace: () => {}
    }

    cmp = shallowMount(TestComponent, {
      mixins: [request],
      global: {
        plugins: [store],
        mocks: {
          $route,
          $router,
        },
      },
    })

  })

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  })

  it('sendXhr: throws error if URL is not present', (done) => {
    new Promise(done => {
      const resp = cmp.vm.sendXhr('')
      resp.catch(err => {
        expect(err.message).toBe('Url is missing!')
        done()
      })
    })
  })

  it('sendXhr: returns a payload if successful GET', (done) => {

    const resp = cmp.vm.sendXhr('https://test.pennsieve.net')
    expect(cmp.vm.method).toBe('GET')
    expect(cmp.vm.body).toBe(null)

    resp.then(msg => {
      expect(msg.status).toBe(200)
    })
  })

  it('sendXhr: sends body if present', (done) => {

    const body = { id: 1 }
    const resp = cmp.vm.sendXhr('https://test.pennsieve.net', {
      method: 'POST',
      body
    })
    expect(cmp.vm.method).toBe('POST')
    expect(cmp.vm.body).toBe(JSON.stringify(body))

    resp.then(msg => {
      expect(msg.status).toBe(200)
    })
  })

  it('sendXhr: handles error status code', (done) => {

    const resp = cmp.vm.sendXhr('https://test.pennsieve.net/delete/unauth', {
      method: 'DELETE',
      body: { id: 1 }
    })

    resp.catch(msg => {
      expect(msg.status).toBe(403)
      done()
    })
  })

  it('handleXhrError: handles errors', (done) => {
    EventBus.$on('ajaxError', () => new Promise(done => {
      done()
    }))
    cmp.vm.handleXhrError({status: 500})
    cmp.vm.$nextTick(() => {
      expect(cmp.vm.isLoading).toBe(false)
    })
  })

  it('handleXhrError: handles 401', () => {
    const spy = vi.spyOn(cmp.vm, 'handleLogout')
    cmp.vm.handleXhrError({status: 401})
    expect(spy).toBeCalled()
  })

  it('handleXhrError: handles 403', () => {
    const spy = vi.spyOn(cmp.vm.$router, 'replace')
    cmp.vm.handleXhrError({status: 403})
    expect(spy).toBeCalled()
  })

})
