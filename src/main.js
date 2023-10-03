
import { createApp, getCurrentInstance } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';
import Cookies from 'js-cookie'

import Amplify from '@aws-amplify/core'
import AWSConfig from './utils/aws-exports.js'
import {ElMessage} from 'element-plus'
import VueClipboard from 'vue3-clipboard'


// Need to import CSS specifically because we are only using the component API.
// https://element-plus.org/en-US/guide/quickstart.html#manually-import
import 'element-plus/es/components/message/style/css';
import {path, pathOr} from "ramda";

Amplify.configure(AWSConfig)

const app = createApp(App);

app.use(store);
app.use(VueClipboard, {
    autoSetContainer: true,
    appendToBody: true,
})

app.use(router);

app.mount("#app");

app.config.globalProperties.$sanitize = (html, allowedTags=['br']) => striptags(html, allowedTags)
app.config.globalProperties.$message = ElMessage;


// Top level routes allowList
const topLevelRoutes = [
    'datasets-list',
    'people-list',
    'teams-list',
    'integrations',
    'settings',
    'my-settings-container'
]

// Users should be able to access the following routes without authentication
const allowList = [
    'home',
    'password',
    'welcome',
    'setup-profile',
    'setup-profile-accept',
    'verify-account',
    'welcome-to-pennsieve',
    'docs-login',
    'jupyter-login',
    'create-account']

router.beforeEach((to, from, next) => {
    // ensure user is authorized to use the app

    if (allowList.indexOf(to.name) >= 0) {
        // Support Unauthenticated Access for AllowList Routes
        next()
    } else {
        // Requires Authenticated Access

        const token = Cookies.get('user_token')
        const savedOrgId = Cookies.get('preferred_org_id')
        const stateToken = store.state.userToken

        if (token && !stateToken) {
            store.dispatch('updateUserToken', token)
        }

        if (!token) {
            // Not authenticated --> Route to login with optional redirect after login.
            const destination = to.fullPath
            if (destination && destination.name !== 'page-not-found') {
                next(`/?redirectTo=${destination}`)
            } else {
                next('/')
            }
        } else {
            // Is Authenticated --> Route to destination, or Dataset Overview if route is login route.

            if (token && to.name === 'home' && savedOrgId) {
                next(`/${savedOrgId}/datasets`)
            } else {
                next()
            }
        }
    }
})

router.beforeResolve(async to => {
    if (allowList.indexOf(to.name) < 0 &&
        !store.state.activeOrgSynced &&
        store.state.userToken) {
        // Org is not synced yet --> Sync org and get org assets.

        // TODO: Need to sync Workspace and get Workspace assets here
        // This now happens in app.vue/bootup, and getProfileAndOrg in GlobalMessageHandler
        // If we handle that here, we should be able to remove some watchers that might introduce race conditions.

        console.log("Router Resolve Requires fetching of Workspace data")

    }
})

router.afterEach((to, from) => {
    window.Intercom('update')

    // Set nav state based on routegit a
    if (topLevelRoutes.indexOf(to.name) >= 0) {
        store.dispatch('togglePrimaryNav', true)
        store.dispatch('condensePrimaryNav', false)
        store.dispatch('condenseSecondaryNav', false)
    }
})
