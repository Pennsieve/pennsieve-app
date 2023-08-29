
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';
import Cookies from 'js-cookie'

import Amplify from '@aws-amplify/core'
import AWSConfig from './utils/aws-exports.js'
import {ElMessage} from 'element-plus'

Amplify.configure(AWSConfig)

const app = createApp(App);

app.config.globalProperties.$sanitize = (html, allowedTags=['br']) => striptags(html, allowedTags)
app.config.globalProperties.$message = ElMessage;

app.use(store);

app.use(router);

app.mount("#app");

const isAuthorized = (to, from, next) => {
    const token = Cookies.get('user_token')
    const savedOrgId = Cookies.get('preferred_org_id')
    const allowList = ['home', 'password', 'welcome', 'setup-profile', 'setup-profile-accept', 'verify-account','welcome-to-pennsieve', 'docs-login', 'jupyter-login','create-account']
    if (allowList.indexOf(to.name) < 0 && !token) {
        const destination = to.fullPath
        if (destination && destination.name !== 'page-not-found') {
            next(`/?redirectTo=${destination}`)
        } else {
            next('/')
        }
    } else if (token && to.name === 'home' && savedOrgId) {
        next(`/${savedOrgId}/datasets`)
    }
}

// Top level routes allowList
const topLevelRoutes = [
    'datasets-list',
    'people-list',
    'teams-list',
    'integrations',
    'settings',
    'my-settings-container'
]

router.beforeEach((to, from, next) => {
    // ensure user is authorized to use the app
    isAuthorized(to, from, next)

    // Store the last route for history
    if (from.name && from.name !== 'viewer') {
        store.dispatch('setLastRoute', from)
    }

    next()
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