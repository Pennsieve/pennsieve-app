import { fetchAuthSession } from "aws-amplify/auth";
import * as siteConfig from "@/site-config/site.json";
import Cookies from "js-cookie";

export async function useGetToken() {
  try {
    const session = await fetchAuthSession();
    return session?.tokens?.accessToken.toString();
  } catch (error) {
    console.log(error);
    // If we don't have a token, redirect to discover app
    window.location.replace(siteConfig.discoverAppUrl);
  }
}

export async function useGetAllTokens() {
  try {
    const session = await fetchAuthSession();

    // Get the refresh token from cookie storage
    // The key format is: CognitoIdentityServiceProvider.<clientId>.<username>.refreshToken
    let refreshToken = null;

    // Get all cookies and find the one with refreshToken
    const allCookies = Cookies.get();
    const refreshTokenKey = Object.keys(allCookies).find((key) =>
      key.includes("refreshToken")
    );
    if (refreshTokenKey) {
      refreshToken = Cookies.get(refreshTokenKey);
    }

    return {
      accessToken: session?.tokens?.accessToken.toString(),
      idToken: session?.tokens?.idToken.toString(),
      refreshToken: refreshToken,
    };
  } catch (error) {
    console.log(error);
  }
}

export async function useLogout() {
  Auth.logout();
}
