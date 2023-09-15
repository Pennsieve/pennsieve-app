import { createRouter, createWebHistory } from "vue-router";


const BfNavigation = () => import('../components/bf-navigation/BfNavigation.vue')

const Datasets = () => import('./datasets/Datasets.vue')
const BfDatasetList = () => import('../components/datasets/dataset-list/BfDatasetList.vue')

/**
 * Settings Components
 */
const Settings = () => import('./OrgSettings/Settings.vue')
const OrgSettings = () => import('../components/OrgSettings/OrgSettings.vue')
const MySettings = () => import('./MySettings/MySettings.vue')
const MySettingsContainer = () => import('../components/my-settings/MySettingsContainer.vue')


const People = () => import('./people/People.vue')
const PeopleList = () => import('../components/people/list/PeopleList.vue')

const Teams = () => import('./teams/Teams.vue')
const TeamsList = () => import('../components/teams/list/TeamsList.vue')
const TeamMembers = () => import('./team-members/TeamMembers.vue')
const TeamMembersList = () => import('../components/teams/members/TeamMembersList.vue')

const BfDatasetSettings = () => import('../components/datasets/settings/BfDatasetSettings.vue')

/**
 * Integrations Components
 */
const Integrations = () => import('./Integrations/Integrations.vue')
const IntegrationsList = () => import ('../components/Integrations/IntegrationsList/IntegrationsList.vue')
const ApplicationsList = () => import ('../components/Integrations/applicationsList/ApplicationsList.vue')



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      components: {
        page: () => import("../views/Login.vue"),
      },
      props: true,
    },
    {
      name: "create-account",
      path: "/sign-up",
      components: {
        page: () => import("../views/Login.vue"),
      },
      props: true,
    },
    {
      path: "/about",
      name: "about",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import("../views/Login.vue"),
    },
    /**
     * Datasets routes
     */
    {
      path: '/:orgId/datasets',
      components: {
        page: Datasets,
        navigation: BfNavigation
      },
      props: true,
      children: [
        {
          name: 'datasets-list',
          path: '',
          components: {
            stage: BfDatasetList
          },
          props: true
        }
      ]
    },
    {
      name: "people",
      path: '/:orgId/people',
      components: {
        page: People,
        navigation: BfNavigation
      },
      children: [
        {
          name: 'people-list',
          path: '',
          components: {
            stage: PeopleList
          }
        },
      ],
      props: true
    },
    {
      path: '/:orgId/teams',
      components: {
        page: Teams,
        navigation: BfNavigation
      },
      children: [
        {
          name: 'teams-list',
          path: '',
          components: {
            stage: TeamsList
          }
        },
      ],
      props: true
    },
    {
      name: 'integrations',
      path: '/:orgId/integrations',
      components: {
        page: Integrations,
        navigation: BfNavigation
      },
      redirect: {
        name: 'applications'
      },
      props: true,
      children: [
        {
          name: 'applications',
          path: 'applications',
          components: {
            stage: ApplicationsList,
          },
          props: true
        },
        {
          name: 'webhooks',
          path: 'webhooks',
          components: {
            stage: IntegrationsList,
          },
          props: true
        },
      ]
    },
    {
      path: '/:orgId/teams/:id',
      components: {
        page: TeamMembers,
        navigation: BfNavigation
      },
      children: [
        {
          name: 'team-members-list',
          path: '',
          components: {
            stage: TeamMembersList
          }
        },
      ],
      props: true
    },
    {
      path: '/:orgId/settings',
      components: {
        page: Settings,
        navigation: BfNavigation
      },
      children: [
        {
          name: 'settings',
          path: '',
          components: {
            stage: OrgSettings
          }
        },
      ],
      props: true
    },
    {
      path: '/:orgId/profile',
      components: {
        page: MySettings,
        navigation: BfNavigation
      },
      children: [
        {
          name: 'my-settings-container',
          path: '',
          components: {
            stage: MySettingsContainer
          }
        },
      ],
      props: true
    },

  ],
});

export default router;
