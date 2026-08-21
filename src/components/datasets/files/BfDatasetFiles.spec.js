import Vuex, { mapActions } from 'vuex'
import { shallowMount } from '@vue/test-utils'
import BfDatasetFiles from './BfDatasetFiles.vue'
import { state, actions, mutations, getters } from '../../../store'
import uploadModule from '../../../store/uploadModule'

describe('bf-dataset-files.vue', () => {
  let cmp
  let store
  let $route

  const evt = {
    packageDTO: {
      children: [],
      content: {
        createdAt: '2018-05-22T13:26:43.097679Z',
        datasetId: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb',
        id: 'N:package:c0c7248f-59da-4f09-888c-fdb8eed1750c',
        name: 'Baker',
        packageType: 'PDF',
        state: 'READY',
        updatedAt: '2018-06-17T13:26:43.097679Z'
      },
      icon: 'PDF',
      properties: [],
      storage: 32430,
      subtype: 'PDF'
    },
    uploadDestination: {
      id: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb'
    }
  }

  beforeEach(() => {
    $route = {
      params: {
        datasetId: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb',
        fileId: ''
      }
    }
    store = new Vuex.Store({
      state,
      actions,
      mutations,
      getters,
      modules: { uploadModule }
    })
    cmp = shallowMount(BfDatasetFiles, {
      data() {
        return {
          files: [
            {
              children: [],
              content: {
                createdAt: '2018-06-11T13:26:43.097679Z',
                datasetId: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb',
                id: 'N:package:77c88edb-b881-4b18-a5df-b1d49f155095',
                name: 'settings',
                packageType: 'Image',
                state: 'READY',
                updatedAt: '2018-07-16T19:22:34.418883Z'
              },
              icon: 'XML',
              properties: [],
              storage: 71182,
              subtype: 'XML'
            }
          ],
          sortBy: 'content.name',
          sortDirection: 'asc'
        }
      },
      global: {
        plugins: [ store],
        mocks: {
          $route
        },
      },

    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resetSelectedFiles()', () => {
    cmp.vm.selectedFiles = [{ content: {} }]
    cmp.vm.lastSelectedFile = { content: {} }

    cmp.vm.resetSelectedFiles()

    expect(cmp.vm.selectedFiles.length).toEqual(0)
    expect(cmp.vm.lastSelectedFile).toEqual({})
  })

  it('onAddUploadedFile() - Update files list', () => {
    cmp.vm.onAddUploadedFile(evt)
    expect(cmp.vm.files.length).toEqual(1)
  })

  // Regression: deleting a file and immediately re-uploading it produced
  // "settings (1)". syncManifest pre-resolves name conflicts against
  // uploadModule.currentTargetPackage.children, which only fetchFiles /
  // silentlyFetchFiles used to write — so a deleted row lingered there and
  // the client suffixed the new upload itself.
  it('onDelete() - frees the deleted name in the upload conflict snapshot', () => {
    const deletedId = 'N:package:77c88edb-b881-4b18-a5df-b1d49f155095'
    store.commit('uploadModule/SET_CURRENT_TARGET_PACKAGE', {
      content: { id: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb' },
      children: [...cmp.vm.files]
    })

    cmp.vm.onDelete({ success: [deletedId] })

    const names = store.state.uploadModule.currentTargetPackage.children.map(
      (c) => c.content.name
    )
    expect(cmp.vm.files.length).toEqual(0)
    expect(names).not.toContain('settings')
  })

  it('onFolderCreated() - claims the new name in the upload conflict snapshot', () => {
    store.commit('uploadModule/SET_CURRENT_TARGET_PACKAGE', {
      content: { id: 'N:dataset:8c02e00f-1b77-4f84-9e89-664443da13bb' },
      children: [...cmp.vm.files]
    })

    cmp.vm.onFolderCreated({
      children: [],
      content: { id: 'N:collection:1', name: 'new folder', packageType: 'Collection' }
    })

    const names = store.state.uploadModule.currentTargetPackage.children.map(
      (c) => c.content.name
    )
    expect(names).toContain('new folder')
  })
})
