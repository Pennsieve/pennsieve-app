import { signOut } from "aws-amplify/auth";
import Cookies from "js-cookie";

// Amplify keeps the session in cookies (CookieStorage, main.js), named
// CognitoIdentityServiceProvider.<clientId>.<user>.<token>.
const TOKEN_COOKIE = /^CognitoIdentityServiceProvider\./;

/**
 * Ends the stored session, whatever state it is in. An old session must never
 * stop a new sign-in: a refresh token past its lifetime can't be revoked or
 * used ("Refresh Token has expired"), so when signing out fails the session's
 * cookies are removed here instead. On the cookie domain (site.json
 * app_domain) and on the page's own host, since either may hold them.
 */
export async function endSession(domain) {
  try {
    await signOut();
  } catch (err) {
    console.warn("Signing out failed; removing the stored session:", err?.message);
  }
  for (const name of Object.keys(Cookies.get())) {
    if (TOKEN_COOKIE.test(name)) {
      Cookies.remove(name, { path: "/" });
      if (domain) {
        Cookies.remove(name, { path: "/", domain });
      }
    }
  }
}
