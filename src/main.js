
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';
import Cookies from 'js-cookie'
import * as siteConfig from '@/site-config/site.json'
import { VueReCaptcha } from 'vue-recaptcha-v3'
import Amplify from '@aws-amplify/core'
import AWSConfig from './utils/aws-exports.js'
import { ElMessage } from 'element-plus'
import VueClipboard from 'vue3-clipboard'
import ClickOutside from './utils/ClickOutsideDirective'; // Adjust the import path according to your project structure
import request from './mixins/request'


// This does not work correctly with Vite:
// import Vue3Sanitize from "vue-3-sanitize";


// Need to import CSS specifically because we are only using the component API.
// https://element-plus.org/en-US/guide/quickstart.html#manually-import
import 'element-plus/es/components/message/style/index';

Amplify.configure(AWSConfig)

// Enabling this will log debug messages to the console.
// Pusher.logToConsole = true;

// const pusher = new Pusher(siteConfig.pusherConfig.appId, {
//     cluster: siteConfig.pusherConfig.region
// });

// var channel = pusher.subscribe('dataset-d5d316ca-ae61-4633-bb0c-39a6dec18407');
// channel.bind('upload-event', function(data) {
// });

const app = createApp(App)

app.directive('click-outside', ClickOutside)

app.use(store);


app.use(VueClipboard, {
    autoSetContainer: true,
    appendToBody: true,
})

app.use(VueReCaptcha, {
    siteKey: siteConfig.reCAPTCHASiteKey,
    loaderOptions: {
        autoHideBadge: true,
        explicitRenderParameters: {
            badge: 'bottomright'
        }
    },
  })

app.use(router);
// app.use(Vue3Sanitize);

// In your main.js or App.vue
window.addEventListener('beforeunload', () => {
    store.dispatch('resetState');
  });


app.mount("#app");

app.config.globalProperties.$sanitize = (html, allowedTags=['br']) => striptags(html, allowedTags)
app.config.globalProperties.$message = ElMessage;
app.config.globalProperties.$pusher = new Pusher(siteConfig.pusherConfig.appId, {
    cluster: siteConfig.pusherConfig.region
});

const sessionRefreshThreshold = 300;

// Top level routes allowList
const topLevelRoutes = [
    'datasets-list',
    'people-list',
    'teams-list',
    'analysis',
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

    const token = Cookies.get('user_token')
    const savedOrgId = Cookies.get('preferred_org_id')

    if (to.name === 'home' && token && savedOrgId) {
        // Special case for 'home' page; if previously logged in, and session stored, then
        // forward to dataset listing page for the organization.

        next(`/${savedOrgId}/datasets`)
    } else if (allowList.indexOf(to.name) >= 0) {
        // Support Unauthenticated Access for AllowList Routes including 'home'

        next()
    } else {
        // Requires Authenticated Access

        const stateToken = store.state.userToken

        // Store usertoken in Vuex
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

            // Check for session time-out and refresh token if within refresh threshold
            const sessionT = store.state.sessionTimer

            if (!store.state.isRefreshing && sessionT && sessionT < sessionRefreshThreshold) {
                const usr = store.state.cognitoUser
                if (usr) {
                    const currentSession = usr.signInUserSession;
                    if (currentSession) {
                        store.dispatch('setIsRefreshing', true)

                        usr.refreshSession(usr.signInUserSession.refreshToken, async (err, session) => {
                            const timeOut = session.accessToken.payload.exp
                            await store.dispatch('setSessionTimer', Math.round((timeOut * 1000 - Date.now()) / 1000))
                            await store.dispatch('updateUserToken', session.accessToken.jwtToken)
                                .then(() => store.dispatch('setIsRefreshing', false))

                        })
                    }
                }
            }

            next()

        }
    }
})

router.beforeResolve(async to => {
    const destination = to.fullPath

    if (destination.name != 'home' &&
        allowList.indexOf(to.name) < 0 &&
        !store.state.activeOrgSynced && store.state.userToken) {
        // Org is not synced yet --> Sync org and get org assets.

        // TODO: Need to sync Workspace and get Workspace assets here
        // This now happens in app.vue/bootup, and getProfileAndOrg in GlobalMessageHandler
        // If we handle that here, we should be able to remove some watchers that might introduce race conditions.

    }
})

router.afterEach((to, from) => {

    // Set nav state based on routegit a
    if (topLevelRoutes.indexOf(to.name) >= 0) {
        store.dispatch('togglePrimaryNav', true)
        store.dispatch('condensePrimaryNav', false)
        store.dispatch('condenseSecondaryNav', false)
    }
})
