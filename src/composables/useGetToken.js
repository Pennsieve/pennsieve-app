import { fetchAuthSession } from 'aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import * as siteConfig from '@/site-config/site.json'


export async function useGetToken() {
    try {
        const session = await fetchAuthSession();
        return session?.tokens?.accessToken.toString();
    } catch (error) {
        console.log(error)
        // If we don't have a token, redirect to discover app
        window.location.replace(siteConfig.discoverAppUrl)
    }
}

export async function useGetTokens() {
    try {
        const session = await fetchAuthSession();

        // Get the refresh token from the token provider's storage
        const tokens = await cognitoUserPoolsTokenProvider.getTokens();

        return {
            accessToken: session?.tokens?.accessToken.toString(),
            idToken: session?.tokens?.idToken.toString(),
            refreshToken: tokens?.refreshToken?.toString()
        };
    } catch (error) {
        console.log(error);
        // If we don't have a token, redirect to discover app
        window.location.replace(siteConfig.discoverAppUrl);
    }
}



export async function useLogout() {
    Auth.logout()
}
