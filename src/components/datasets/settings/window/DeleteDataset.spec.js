import { shallowMount } from '@vue/test-utils'
import DeleteDataset from './DeleteDataset.vue'
import Vuex from 'vuex'
import { getters } from '../../../../store'


describe('DeleteDataset.vue', () => {
  let cmp
  let store

  beforeEach(() => {
    const state = {
      datasetPublishedData: [
        {
          sourceOrganizationId: 5,
          sourceDatasetId: 1,
          publishedDatasetId: 109,
          publishedVersionCount: 2,
          status: 'PUBLISH_SUCCEEDED',
          lastPublishedDate: {}
        }
      ],
      dataset: {
        content: {
          name: 'Test Dataset',
          intId: 1
        }
      },
      activeOrganization: {
        organization: {
          name: 'Blackfynn'
        }
      },

    }
    store = new Vuex.Store({
      state,
      getters
    })
    cmp = shallowMount(DeleteDataset, {
      global: {
        plugins:[store]
      }
    })
  })

  it('Computes datasetName', () => {
    expect(cmp.vm.datasetName).toBe('Test Dataset')
  })

  it('Computes stepOneLabelText', () => {
    expect(cmp.vm.stepOneLabelText.indexOf('Blackfynn') > 0).toBe(true)
  })

  it('closeDialog()', () => {
    cmp.vm.closeDialog()
    expect(cmp.vm.form.checkBoxes.length).toBe(0)
    expect(cmp.vm.disabled).toBe(true)
    expect(cmp.vm.dialogVisible).toBe(false)
  })
})
