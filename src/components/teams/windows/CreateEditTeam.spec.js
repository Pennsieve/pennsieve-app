import Vuex from 'vuex'
import { mount } from '@vue/test-utils'
import CreateEditTeam from './CreateEditTeam.vue'
import { actions, mutations, getters } from '../../../store'
import EventBus from '../../../utils/event-bus'
import ElementPlus from 'element-plus'

const Event = {
  preventDefault: vi.fn(() => {})
}

describe('CreateEditTeam.vue', () => {
  let cmp
  let store
  let state

  beforeEach( async () => {
    state = {
      config: {
        apiUrl: 'https://app.blackfynn.net'
      },
      userToken: '123',
      activeOrganization: {
        organization: {
          name: 'Blackfynn',
          id: 666
        }
      },
      teams: [
        {
          team: {
            id: 17,
            name: 'The Birds'
          }
        }, {
          team: {
            id: 11,
            name: 'The Giants'
          }
        }
      ]
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters
    })
    cmp = mount(CreateEditTeam, {
      global: {
        plugins:[store, ElementPlus]
      },
      propsData: {
        team: {
          team: {
            id: 17,
            name: 'The Birds'
          }
        }
      }
    })

    await cmp.setProps({ dialogVisible: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    EventBus.$off()
  })

  it('onHandleKeyPressed', () => {
    const spy = vi.spyOn(cmp.vm, 'createEditTeam')
    const teamForm = cmp.findComponent({ ref: 'teamForm' })

    teamForm.validate = () => {}
    // cmp.vm.$refs.teamForm.validate = () => {}
    cmp.vm.onHandleKeyPressed(Event)
    // expect(Event.preventDefault).toBeCalled()
    expect(spy).toBeCalled()
  })

  it('teamNameExists', () => {
    const teamA = cmp.vm.teamNameExists('The Birds')
    expect(teamA).toBe(true)

    const teamB = cmp.vm.teamNameExists('The Redskins')
    expect(teamB).toBe(false)
  })

  it('createUrl: POST', async() => {
    const expectedUrl = 'https://app.blackfynn.net/organizations/666/teams?api_key=undefined'
    const createUrl = await cmp.vm.createUrl('POST')
    expect(createUrl).toBe(expectedUrl)
  })

  it('createUrl: PUT', async () => {
    const expectedUrl = 'https://app.blackfynn.net/organizations/666/teams/17?api_key=undefined'
    const createUrl = await cmp.vm.createUrl('PUT')
    expect(createUrl).toBe(expectedUrl)
  })

  it('closeDialog', () => {
    cmp.vm.closeDialog()
    expect(cmp.emitted()).toHaveProperty('close-dialog')
    // expect(cmp.vm.dialogVisible).toBe(false)
  })

  it('createEditTeam: invalid state', () => {
    const spy = vi.spyOn(cmp.vm, 'submitRequest')
    cmp.vm.$refs.teamForm.validate = (cb) => {
      return cb(false)
    }
    cmp.vm.createEditTeam('teamForm')
    expect(spy).not.toBeCalled()
  })

  it('createEditTeam: valid state', () => {
    cmp.vm.ruleForm.name = 'The Iggles'
    const spy = vi.spyOn(cmp.vm, 'submitRequest')
    cmp.vm.$refs.teamForm.validate = (cb) => {
      return cb(true)
    }
    cmp.vm.createEditTeam('teamForm')
    expect(spy).toBeCalled()
  })

  it('createEditTeam: same name', () => {
    cmp.vm.ruleForm.name = 'The Birds'
    const spy = vi.spyOn(cmp.vm, 'closeDialog')
    cmp.vm.$refs.teamForm.validate = (cb) => {
      return cb(true)
    }
    cmp.vm.createEditTeam('teamForm')
    expect(spy).toBeCalled()
  })

  // it('submitRequest(): success + close dialog', (done) => {
  //   const closeSpy = vi.spyOn(cmp.vm, 'closeDialog')
  //   fetch.mockResponseOnce('toast', {status: 200})
  //   cmp.vm.submitRequest()
  //   flushPromises().then(() => {
  //     expect(closeSpy).toBeCalled()
  //     done()
  //   })
  // })
  //
  // it('submitRequest(): success + created toast', (done) => {
  //   cmp.vm.team = {}
  //   const closeSpy = vi.spyOn(cmp.vm, 'closeDialog')
  //   EventBus.$on('toast', payload => {
  //     const expectedMsg = `${cmp.vm.ruleForm.name} created`
  //     expect(payload.detail.msg).toBe(expectedMsg)
  //     done()
  //   })
  //   fetch.mockResponseOnce('toast', {status: 200})
  //   cmp.vm.submitRequest()
  // })

  // it('submitRequest(): success + team-created event', (done) => {
  //   cmp.vm.team = {}
  //   const closeSpy = vi.spyOn(cmp.vm, 'closeDialog')
  //   cmp.vm.$on('team-created', () => {
  //     done()
  //   })
  //   fetch.mockResponseOnce('team-created', {status: 200})
  //   cmp.vm.submitRequest()
  // })
  //
  // it('submitRequest(): success + updated toast', (done) => {
  //   EventBus.$on('toast', payload => {
  //     const expectedMsg = `${cmp.vm.ruleForm.name} updated`
  //     expect(payload.detail.msg).toBe(expectedMsg)
  //     done()
  //   })
  //   fetch.mockResponseOnce('toast', {status: 200})
  //   cmp.vm.submitRequest()
  // })




  it('close-dialog effects', async () => {
    const teamForm = cmp.findComponent({ ref: 'teamForm' })
    const spy = vi.spyOn(teamForm.vm, 'resetFields').mockImplementation(() => {})

    await cmp.vm.closeDialog()
    expect(spy).toHaveBeenCalled()

    let ev = cmp.emitted()
    expect(ev['close-dialog']).toBeTruthy()
  })
})
