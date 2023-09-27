
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

router.beforeEach((to, from, next) => {
    // ensure user is authorized to use the app

    console.log('ads')
    const token = Cookies.get('user_token')
    const savedOrgId = Cookies.get('preferred_org_id')
    const stateToken = store.state.userToken

    if (token && !stateToken) {
        console.log('Update token in beforeEach')
        store.dispatch('updateUserToken', token)
    }

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


    if (allowList.indexOf(to.name) < 0 && !token) {
        const destination = to.fullPath
        if (destination && destination.name !== 'page-not-found') {
            next(`/?redirectTo=${destination}`)
        } else {
            next('/')
        }
    } else if (token && to.name === 'home' && savedOrgId) {
        next(`/${savedOrgId}/datasets`)
    } else {
        next()
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