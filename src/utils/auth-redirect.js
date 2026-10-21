import * as siteConfig from '@/site-config/site.json'
import { isFeatureEnabled } from '@/utils/features'

export const DEFAULT_LANDING_PATH = '/my-workspace/shared'

// Only same-origin paths: "//host" and "/\host" are protocol-relative in browsers.
export function safeRedirectPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/')) return null
  return value
}

export function loginQuery(returnPath) {
  const redirectTo = safeRedirectPath(returnPath)
  return redirectTo && redirectTo !== '/' ? { redirectTo } : {}
}

export function redirectToLogin(returnPath = window.location.pathname + window.location.search) {
  if (!isFeatureEnabled('inAppLogin')) {
    window.location.replace(siteConfig.discoverAppUrl)
    return
  }
  const params = new URLSearchParams(loginQuery(returnPath)).toString()
  window.location.replace(params ? `/login?${params}` : '/login')
}
