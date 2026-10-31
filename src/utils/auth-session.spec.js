import { describe, it, expect, vi, beforeEach } from 'vitest'

const signOut = vi.fn()
vi.mock('aws-amplify/auth', () => ({ signOut: (...args) => signOut(...args) }))

const { endSession } = await import('./auth-session')

const cookieNames = () => document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean)

describe('endSession', () => {
  beforeEach(() => {
    signOut.mockReset()
    for (const name of cookieNames()) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
    document.cookie = 'CognitoIdentityServiceProvider.client.user.refreshToken=stale; path=/'
    document.cookie = 'CognitoIdentityServiceProvider.client.LastAuthUser=user; path=/'
    document.cookie = 'other=kept; path=/'
  })

  it('signs out and leaves no session behind', async () => {
    signOut.mockResolvedValue(undefined)
    await endSession()
    expect(signOut).toHaveBeenCalled()
    expect(cookieNames()).toEqual(['other'])
  })

  // An expired refresh token can't be revoked: the sign-in must still go ahead.
  it('removes the session when signing out fails', async () => {
    signOut.mockRejectedValue(Object.assign(new Error('Refresh Token has expired'), { name: 'NotAuthorizedException' }))
    await expect(endSession()).resolves.toBeUndefined()
    expect(cookieNames()).toEqual(['other'])
  })
})
