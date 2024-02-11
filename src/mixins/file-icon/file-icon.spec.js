import {shallow, shallowMount} from '@vue/test-utils'

import FileIcon from './'
import TestComponent from "../test-component.vue";

describe('FileIcon Mixin', () => {

  let cmp

  beforeEach(() => {
    cmp = shallowMount(TestComponent, {
      mixins: [FileIcon],
      data() {
        return {
          placeholder: ''
        }
      }
    })

  })

  it('fileIcon: returns Collection folder icon', () => {
    const collectionIcon = cmp.vm.fileIcon('', 'Collection')
    expect(collectionIcon.indexOf('icon-folder') >= 0).toBe(true)
  })

  it('fileIcon: returns known icon', () => {
    const icon = cmp.vm.fileIcon('Docker', 'dockerfile')
    expect(icon.indexOf('icon-docker') >= 0).toBe(true)
  })

  it('fileIcon: returns default icon', () => {
    const collectionIcon = cmp.vm.fileIcon('', '')
    expect(collectionIcon.indexOf('icon-generic') >= 0).toBe(true)
  })
})