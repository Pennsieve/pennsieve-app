/* eslint-disable no-undef */
import { getters } from './index'

describe('datasetOwner getters', () => {
  const profile = {
    id: 'N:user:owner',
    firstName: 'Ada',
    lastName: 'Owner',
    orcid: { orcid: '0000-0001-2345-6789' }
  }
  const orgMember = {
    id: 'N:user:member',
    firstName: 'Bo',
    lastName: 'Member',
    orcid: { orcid: '0000-0009-8765-4321' }
  }

  const resolve = (state) => {
    const g = { getOrgMember: getters.getOrgMember(state) }
    g.datasetOwner = getters.datasetOwner(state, g)
    g.datasetOwnerHasOrcidId = getters.datasetOwnerHasOrcidId(state, g)
    return g
  }

  it('uses the profile when the current user owns the dataset and org members are not loaded', () => {
    const g = resolve({ profile, orgMembers: [], dataset: { owner: profile.id } })
    expect(g.datasetOwner).toBe(profile)
    expect(g.datasetOwnerHasOrcidId).toBe(true)
  })

  it('looks up other owners in the org members', () => {
    const g = resolve({ profile, orgMembers: [orgMember], dataset: { owner: orgMember.id } })
    expect(g.datasetOwner).toEqual(orgMember)
    expect(g.datasetOwnerHasOrcidId).toBe(true)
  })

  it('reports no ORCID when the owner cannot be resolved', () => {
    const g = resolve({ profile, orgMembers: [], dataset: { owner: orgMember.id } })
    expect(g.datasetOwner).toEqual({})
    expect(g.datasetOwnerHasOrcidId).toBe(false)
  })

  it('does not match an empty owner to a profile without an id', () => {
    const g = resolve({ profile: { orcid: {} }, orgMembers: [], dataset: {} })
    expect(g.datasetOwner).toEqual({})
  })
})
