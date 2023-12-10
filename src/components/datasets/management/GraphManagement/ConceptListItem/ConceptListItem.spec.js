import Vuex, {createStore} from 'vuex'
import { RouterLinkStub, shallowMount } from '@vue/test-utils'
import ConceptListItem from './ConceptListItem.vue' // import the right component
import EventBus from '../../../../../utils/event-bus'

const store = createStore({
  state() {
    return {
    }
  },
  actions: {
  }
})

const $router = {
  push: vi.fn(() => {})
}

describe('ConceptListItem.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = shallowMount(ConceptListItem, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        },
        plugins: [store],
        mocks :{
          $router
        },
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    EventBus.$off()
  })

  it ('onMenuSelect(): should redirect to the concept page when configure is selected', () => {
    const command = 'configure'
    const spy = vi.spyOn(cmp.vm, 'openConcept')
    cmp.vm.onMenuSelect(command)
    expect(spy).toBeCalled()
  })

  it('onMenuSelect(): should archive the model when archive is selected', async (done) => {
    const command = 'archive'
    cmp.vm.onMenuSelect(command)
    await cmp.vm.$nextTick()
    let ev = cmp.emitted()
    expect(ev['archive-concept']).toBeTruthy()

  })

  it('onMenuSelect(): should create a new record in the model when new record is selected', () => {
    const command = 'newRecord'
    const spy = vi.spyOn(cmp.vm.$router, 'push')
    cmp.vm.onMenuSelect(command)
    expect(spy).toBeCalled()
  })


  it ('modelId(): it returns the concept id', async () => {
    const cpt = {
      count: 1,
      createdAt: "2018-07-30T13:35:36.439Z",
      createdBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3",
      description: "",
      displayName: "new model",
      icon: null,
      id: "d7dda599-686b-4213-8ade-f17866e8fc9c",
      name: "new_model",
      propertyCount: 2,
      updatedAt: "2018-09-20T18:46:17.904Z",
      updatedBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3"
    }
    await cmp.setProps({
      concept: cpt
    })
    console.log(cmp.vm.modelId)
    expect(cmp.vm.modelId).toEqual(cpt.id)
  })

  it('modelDisplayName() it returns the concept display name', async () => {
    const concept = {
      count: 1,
      createdAt: "2018-07-30T13:35:36.439Z",
      createdBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3",
      description: "",
      displayName: "new model",
      icon: null,
      id: "d7dda599-686b-4213-8ade-f17866e8fc9c",
      name: "new_model",
      propertyCount: 2,
      updatedAt: "2018-09-20T18:46:17.904Z",
      updatedBy: "N:user:5e52cf3b-8bae-4605-aad5-acd4ecbc0ac3"
    }
    await cmp.setProps({
      concept
    })
    expect(cmp.vm.modelDisplayName).toEqual(concept.displayName)
  })

  it('openConcept(): should navigate to the concept details page on click', () => {
    const spy = vi.spyOn(cmp.vm.$router, 'push')
    cmp.vm.openConcept()
    expect(spy).toBeCalled()
  })
})
