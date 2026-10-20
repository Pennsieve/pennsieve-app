import { describe, it, expect, vi, beforeEach } from 'vitest'

const enabled = { office365Viewer: true }
vi.mock('@/utils/features', () => ({ isFeatureEnabled: (name) => enabled[name] }))
vi.mock('js-cookie', () => ({ default: { get: vi.fn(() => undefined) } }))
vi.mock('@/router', () => ({ default: {} }))

import { actions } from './filesModule'

describe('openOffice365File', () => {
  beforeEach(() => { enabled.office365Viewer = true })

  it('opens the terms dialog where the Office 365 viewer is on', () => {
    const commit = vi.fn()
    actions.openOffice365File({ commit }, { content: { id: 'N:package:1' } })
    expect(commit).toHaveBeenCalledWith('OPEN_OFFICE_365_DIALOG', { content: { id: 'N:package:1' } })
  })

  it('does nothing where it is off (clin), so no link reaches Microsoft', () => {
    enabled.office365Viewer = false
    const commit = vi.fn()
    actions.openOffice365File({ commit }, { content: { id: 'N:package:1' } })
    expect(commit).not.toHaveBeenCalled()
  })
})
