// logout-handler_composable.js

import {defaultTo, prop} from "ramda";
import Cookies from "js-cookie";
import EventBus from "@/utils/event-bus";
import {useRoute, useRouter} from "vue-router";
import { signOut } from "aws-amplify/auth";
import { isFeatureEnabled } from "@/utils/features";
import { redirectToLogin } from "@/utils/auth-redirect";

export function useHandleLogout(payload) {

    // Checked before useRoute(): this runs from request error handlers, outside component setup.
    if (isFeatureEnabled('inAppLogin')) {
        signOut()
            .catch(error => console.warn('Sign out failed:', error))
            .finally(() => redirectToLogin())
        return
    }

    const route = useRoute()
    const router = useRouter()


    if (route.name === 'docs-login') {
        return
    }

    const shouldShowToast = defaultTo(false, prop('shouldShowToast', payload))
    const shouldRedirect = defaultTo(false, prop('shouldRedirect', payload))

    // clear vuex
    this.clearState()

    // remove user token
    // Cookies.remove('user_token')

    // Add a redirect link
    let query = {}
    if (shouldRedirect) {
        query = {
            redirectTo: this.$route.fullPath
        }
    }

    // route user to login page
    router.replace({
        name: 'home',
        query
    }).then(r => {
        if (shouldShowToast) {
            EventBus.$emit('toast', { detail: { msg: 'Logged Out' }})
        }
    })
}