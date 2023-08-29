import { createRouter, createWebHistory } from "vue-router";


const BfNavigation = () => import('../components/bf-navigation/BfNavigation.vue')

const Datasets = () => import('./datasets/Datasets.vue')
const BfDatasetList = () => import('../components/datasets/dataset-list/BfDatasetList.vue')


const People = () => import('./people/People.vue')
const PeopleList = () => import('../components/people/list/PeopleList.vue')



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
        // page: People,
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
  ],
});

export default router;
