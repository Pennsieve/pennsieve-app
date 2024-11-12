import {fetchAuthSession} from "aws-amplify/auth";
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

export async function useLogout() {
    Auth.logout()
}
