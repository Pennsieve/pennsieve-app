
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';
import Cookies from 'js-cookie'
import * as siteConfig from '@/site-config/site.json'
import { VueReCaptcha } from 'vue-recaptcha-v3'
import AWSConfig from './utils/aws-exports.js'
import { ElMessage } from 'element-plus'
import VueClipboard from 'vue3-clipboard'
import ClickOutside from './utils/ClickOutsideDirective'; // Adjust the import path according to your project structure

// Need to import CSS specifically because we are only using the component API.
// https://element-plus.org/en-US/guide/quickstart.html#manually-import
import { Amplify } from "aws-amplify"
import 'element-plus/es/components/message/style/index';
import { defaultStorage } from 'aws-amplify/utils';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import {fetchAuthSession} from "aws-amplify/auth";

cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage);

Amplify.configure(AWSConfig)



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
    'password',
    'welcome',
    'login',
    'setup-profile',
    'setup-profile-accept',
    'complete-profile-accept',
    'verify-account',
    'welcome-to-pennsieve',
    'docs-login',
    'jupyter-login',
    'create-account'
]

router.beforeEach(async (to, from, next) => {


    // Get token from Amplify -- don't use useGetToken as there are cases
    // where we want to not re-direct even if no token is available
    const session = await fetchAuthSession();
    const token = session?.tokens?.accessToken.toString();

    // If there is no token and route is not on the un-authenticated list --> redirect to discover app
    if (!token && !(allowList.indexOf(to.name) >= 0)) {
        window.location.replace(siteConfig.discoverAppUrl)
    }


    const savedOrgId = Cookies.get('preferred_org_id')

    if (to.name === 'home' && token && savedOrgId) {
        // Special case for 'home' page; if previously logged in, and session stored, then
        // forward to dataset listing page for the organization.

        next(`/${savedOrgId}/datasets`)
    } else if (allowList.indexOf(to.name) >= 0) {
        // Support Unauthenticated Access for AllowList Routes including 'home'

        next()
    } else {
        next()


    }
})

router.beforeResolve(async to => {
    const destination = to.fullPath

    if (destination.name !== 'home' &&
        allowList.indexOf(to.name) < 0 && !store.state.activeOrgSynced) {
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
