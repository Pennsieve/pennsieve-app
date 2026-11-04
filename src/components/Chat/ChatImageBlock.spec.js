import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const dispatch = vi.fn()
vi.mock('vuex', () => ({
  useStore: () => ({ dispatch, state: { activeOrganization: { organization: { id: 'N:organization:1' } } } }),
}))

import ChatImageBlock from './ChatImageBlock.vue'

const mountBlock = (source) =>
  mount(ChatImageBlock, {
    props: { block: { type: 'image', source } },
    global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } },
  })

describe('ChatImageBlock', () => {
  beforeEach(() => dispatch.mockReset())

  it('shows a PNG package through a view link of its source file', async () => {
    dispatch.mockResolvedValue('https://signed.example/plot.png')
    const wrapper = mountBlock({
      packageNodeId: 'N:package:1',
      datasetNodeId: 'N:dataset:1',
      sourceFileId: '42',
    })
    await flushPromises()

    expect(dispatch).toHaveBeenCalledWith('viewerModule/fetchFileUrl', {
      datasetId: 'N:dataset:1',
      packageId: 'N:package:1',
      file: { content: { id: '42', objectType: 'source' } },
    })
    expect(wrapper.find('img').attributes('src')).toBe('https://signed.example/plot.png')
    // No viewer-asset: nothing to save or remove.
    expect(wrapper.findAll('.action-btn')).toHaveLength(1)
  })

  it('falls back to the package link when the source file has no link', async () => {
    dispatch.mockResolvedValueOnce('').mockResolvedValueOnce({ assets: [] })
    const wrapper = mountBlock({
      packageNodeId: 'N:package:1',
      datasetNodeId: 'N:dataset:1',
      sourceFileId: '42',
    })
    await flushPromises()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.fallback-link').exists()).toBe(true)
  })
})
