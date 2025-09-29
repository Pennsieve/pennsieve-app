
import { createApp} from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';
import Cookies from 'js-cookie'
import * as siteConfig from '@/site-config/site.json'
import { VueReCaptcha } from 'vue-recaptcha-v3'
import AWSConfig from './utils/aws-exports.js'
// import { ElMessage } from 'element-plus'
import VueClipboard from 'vue3-clipboard'
import ClickOutside from './utils/ClickOutsideDirective'; // Adjust the import path according to your project structure

// Import Element Plus CSS manually to ensure proper theming
import 'element-plus/dist/index.css'

// Need to import CSS specifically because we are only using the component API.
// https://element-plus.org/en-US/guide/quickstart.html#manually-import
import { Amplify } from "aws-amplify"
// import 'element-plus/es/components/message/style/index';
import { CookieStorage } from 'aws-amplify/utils';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import {fetchAuthSession} from "aws-amplify/auth";
import {useGetProfileAndOrg} from "@/composables/useGetProfileAndOrg";
import {useGetToken} from "@/composables/useGetToken";
import {curryN, find, path, pathOr, propEq, propOr} from "ramda";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import {checkIsSubscribed} from "@/composables/useCheckTerms";
import {useSwitchWorkspace} from "@/composables/useSwitchWorkspace";
import {installDashboard} from 'sparc-dashboard-beta';
import { createPinia } from 'pinia'



import Pusher from 'pusher-js'

Amplify.configure(AWSConfig)

cognitoUserPoolsTokenProvider.setKeyValueStorage(
    new CookieStorage({
            domain: siteConfig.app_domain
        }
    ));


const app = createApp(App)

app.directive('click-outside', ClickOutside)

app.use(store);
installDashboard(app, ["TextWidget"]);

const pinia = createPinia()
app.use(pinia)


//Import Dashboard

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

    // ==== CHECK FOR TOKEN ====
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
        // ==== Support Unauthenticated Access for AllowList Routes including 'home' ====
        next()
    } else {

        // ==== GOING TO AUTHENTICATED PAGE ====
        // ==== GET PROFILE/ORGS AND CHECK PREFERRED ORG ====
        // ==== Only get Profile and Workspaces if they have not been fetched before ====
        if (Object.keys(store.getters.profile).length  === 0) {
            await useGetProfileAndOrg(store)
                .then(() => {
                    return checkActiveOrg(to)})
                .then(() =>{
                    return store.dispatch('setActiveOrgSynced')
                })
                .then(() => {
                    return getPrimaryData()
                }).catch(err => useHandleXhrError(err))
        }

        next()
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

//  ------ HELPER FUNCTIONS -------

// GetPrimaryData calls endpoints that return data that should always
// be available on each page. This data is organization scoped and is
// only renewed on reload of app.
async function getPrimaryData() {

    return useGetToken().then(async token => {

        const activeOrg = store.getters.activeOrganization
        const activeOrgId = activeOrg.organization.id
        const teamUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/teams?api_key=${token}`

        // ==== TEAM AND PUBLISHERS =====
        const teamAndPublishersPromise = useSendXhr(teamUrl)
            .then(response => {
                return store.dispatch('updateTeams', response)
            })
            .then(() => {
                const publisherTeam = store.getters.publisherTeam
                const publisherUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/teams/${publisherTeam.id}/members?api_key=${token}`
                return useSendXhr(publisherUrl)
                    .then(resp => {
                        return store.dispatch('updatePublishers', resp)
                    })
            })

        // ==== ORG MEMBERS =====
        const orgMemberUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/members?api_key=${token}`
        let orgMemberPromise
        if (store.getters.hasFeature('sandbox_org_feature')) {
            orgMemberPromise = Promise.resolve()
        } else {
            orgMemberPromise = useSendXhr(orgMemberUrl)
                .then(resp => {
                    const orgMembers = updateMembers(resp)
                    store.dispatch('updateOrgMembers',orgMembers)
                }).catch(err => useHandleXhrError(err))
        }

        // ==== ORG CONTRIBUTORS ====
        const orgContributorUrl =`${siteConfig.apiUrl}/contributors?api_key=${token}`
        const contributorPromise = useSendXhr(orgContributorUrl)
            .then(resp => {
                store.dispatch('setOrgContributors', resp)
            }).catch(err => useHandleXhrError(err))

        // ==== DATA USE AGREEMENTS ====
        const dataUseAgreementUrl =`${siteConfig.apiUrl}/organizations/${activeOrgId}/data-use-agreements?api_key=${token}`
        const dataUseAgreementPromise = useSendXhr(dataUseAgreementUrl)
            .then(resp => {
                store.dispatch('updateDataUseAgreements', resp)
            }).catch(err => useHandleXhrError(err))

        // ==== Dataset Statuses ====
        const datasetStatusUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/dataset-status?api_key=${token}`
        const datasetStatusPromise = useSendXhr(datasetStatusUrl)
            .then(resp => {
                store.dispatch('updateOrgDatasetStatuses', resp)
            }).catch(err => useHandleXhrError(err))

        const collectionsPromise = store.dispatch('collectionsModule/fetchCollections')

        return Promise.all(
            [
                teamAndPublishersPromise,
                orgMemberPromise,
                contributorPromise,
                dataUseAgreementPromise,
                datasetStatusPromise,
                collectionsPromise
            ])
    })
}

const isInList = curryN(3, _isInList)

function _isInList(member, activeOrganization, listName) {
    const profileId = propOr(0, 'id', member)
    const list = propOr([], listName, activeOrganization)
    const inList =  find(propEq('id', profileId), list)
    return Boolean(inList)
}

function getOrgRole(member, activeOrganization) {
    const checkList = isInList(member, activeOrganization)
    switch(true) {
        case checkList('administrators'):
            return 'Administrator'
        case checkList('owners'):
            return 'Owner'
        default:
            return 'Collaborator'
    }
}

function updateMembers(users) {
    return users.map(member => {
        const role = getOrgRole(member, store.getters.activeOrganization)
        let newFields = { role }
        if (!member.storage) {
            newFields = {
                storage: 0,
                role
            }
        }
        return Object.assign({}, newFields, member)
    })
}

async function checkActiveOrg(to) {
    const preferredOrgId = store.getters.profile.preferredOrganization
    const orgs = store.getters.organizations
    const activeOrgId = preferredOrgId ?
        pathOr(preferredOrgId, ['params', 'orgId'], to) :
        path(['organizations', 0, 'organization', 'id'], orgs)

    const activeOrgIndex = orgs.findIndex(org => Boolean(org.organization.id === activeOrgId))
    const activeOrg = orgs[activeOrgIndex]

    if ((activeOrgId && preferredOrgId) && activeOrgId !== preferredOrgId) {
        return useSwitchWorkspace(activeOrg)
    } else {
        return store.dispatch('updateActiveOrganization', activeOrg)
    }
}


