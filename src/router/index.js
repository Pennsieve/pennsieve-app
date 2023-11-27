import { createRouter, createWebHistory } from "vue-router";
import { PublicationStatus, PublicationTabs } from '../utils/constants.js'
import DatasetSettings from "./Dataset/DatasetSettings.vue";
import DatasetActivityView from "./Dataset/DatasetActivityView.vue";
import DatasetPermissionsView from "./Dataset/DatasetPermissionsView.vue";
import DatasetMetadataHeader from "./Dataset/DatasetMetadataHeader.vue";
import DatasetMetadataView from "./Dataset/DatasetMetadataView.vue";


const BfNavigation = () => import('../components/bf-navigation/BfNavigation.vue')
const BfNavigationSecondary = () => import('../components/bf-navigation/BfNavigationSecondary.vue')

const Datasets = () => import('./Datasets/Datasets.vue')

const BfDatasetList = () => import('../components/datasets/dataset-list/BfDatasetList.vue')
const DatasetListHeader = () => import('./Datasets/DatasetListHeader.vue')
const DatasetOverview = () => import('../components/datasets/DatasetOverview/DatasetOverview.vue')
const SecondaryPageHeader = () => import('./Dataset/SecondaryPageHeader.vue')
const DatasetActivityHeader = () => import('./Dataset/DatasetActivityHeader.vue')
const BfDatasetFiles = () => import('../components/datasets/files/BfDatasetFiles.vue')
const FileDetails = () => import('../components/datasets/files/FileDetails/FileDetails.vue')
const DatasetFilesView = () => import('./Dataset/DatasetFilesView.vue')
const BfPublishingSettings = () => import('../components/datasets/settings/BfPublishingSettings.vue')
const DatasetActivityLog = () => import('../components/datasets/DatasetActivity/DatasetActivityLog.vue')
const DatasetManifests = () => import('../components/datasets/DatasetActivity/DatasetManifests.vue')

const DatasetPermissionsHeader = () => import('./Dataset/DatasetPermissionsHeader.vue')
const DatasetPermissions = () => import('../components/datasets/DatasetPermissions/DatasetPermissions.vue')
const EmbargoedPermissions = () => import('../components/datasets/DatasetPermissions/EmbargoedPermissions/EmbargoedPermissions.vue')
const DatasetIntegrationsSettings = () => import('../components/datasets/settings/DatasetIntegrationsSettings.vue')



/**
 * ORCIDRedirect
 * ORCIDRedirect
 */

const ORCIDRedirect = () => import('../components/ORCID/ORCIDRedirect.vue')
const ORCID = () => import('./ORCID/ORCID.vue')

/**
 * Publishing Components
 */
const Publishing = () => import('./Publishing/PublishingView.vue')
const PublishingDatasetsList = () => import ('../components/Publishing/PublishingDatasetsList/PublishingDatasetsList.vue')
const PublishingProposalsList = () => import ('../components/Publishing/PublishingProposalsList/PublishingProposalsList.vue')


/**
 * Settings Components
 */
const Invite = () => import('./invite/Invite.vue')
const SetupProfile = () => import('../components/SetupProfile/SetupProfile.vue')
const FinalizeAccount = () => import('../components/FinalizeAccount/FinalizeAccount.vue')
const PennsieveInfo = () => import('../components/welcome/Info.vue')


const WelcomePage = () => import('./welcomePage/WelcomePage.vue')
const WelcomeInfo = () => import('../components/welcome/Welcome.vue')
const SubmitDatasetPage = () => import('./welcomePage/SubmitDatasetPage.vue')
const SubmitDatasets = () => import('../components/welcome/SubmitDatasets.vue')





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


/**
 * Metadata Components
 */
// const DatasetRecords = () => import('../components/datasets/records/DatasetRecords/DatasetRecords.vue')
const ModelRecords = () => import('../components/datasets/explore/search/ModelRecords.vue')
const Models = () => import('../components/datasets/management/GraphManagement/Models.vue')
const RelationshipTypes = () => import('../components/datasets/management/GraphManagement/RelationshipTypes.vue')


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      components: {
        page: () => import("./Login/Login.vue"),
      },
      props: true,
    },
    {
      path: '/orcid-redirect',
      components: {
        page: ORCID
      },
      children: [
        {
          name: 'orcid-redirect',
          path: '',
          components: {
            stage: ORCIDRedirect
          }
        },
      ],
    },
    {
      name: "create-account",
      path: "/sign-up",
      components: {
        page: () => import("./Login/Login.vue"),
      },
      props: true,
    },
    {
      path: "/about",
      name: "about",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import("./Login/Login.vue"),
    },
    /**
     * Information Panel for organization
     */
    {
      path: '/:orgId/information',
      components: {
        page: WelcomePage,
        navigation: BfNavigation
      },
      props: true,
      children: [
        {
          name: 'info',
          path: '',
          components: {
            stage: PennsieveInfo
          }
        },
      ],
    },
    /**
     * Welcome Org routes
     */
    {
      path: '/:orgId/overview',
      components: {
        page: WelcomePage,
        navigation: BfNavigation
      },
      props: {
        page: true,
        navigation: true,
      },
      children: [
        {
          name: 'welcome',
          path: '',
          components: {
            stage: WelcomeInfo
          }
        },
      ],
    },
    {
      path: '/:orgId/submit',
      components: {
        page: SubmitDatasetPage,
        navigation: BfNavigation
      },
      props: true,
      children: [
        {
          name: 'submit',
          path: '',
          components: {
            stage: SubmitDatasets
          }
        },
      ],
    },
    /**
     * Datasets routes
     */
    {
      path: '/:orgId/datasets',
      components: {
        page: Datasets,
        navigation: BfNavigation,
        navigationSecondary: BfNavigationSecondary,
      },
      props: {
        page: true,
        navigation: true,
        navigationSecondary: true,
      },
      meta: { hideSecondaryNav: false},
      children: [
        {
          name: 'datasets-list',
          path: '',
          components: {
            stage: BfDatasetList,
            stageHeader:DatasetListHeader,
          },
          props: true,
          meta: { hideSecondaryNav: true},
        },
        {
          name: 'dataset-overview',
          path: ':datasetId/overview',
          components: {
            stage: DatasetOverview,
          },
          props: {
            stage: true,
          }
        },
        {
          name: 'dataset-files-wrapper',
          path: ':datasetId/files',
          components: {
            stageHeader: SecondaryPageHeader,
            stage: DatasetFilesView
          },
          props: {
            stage: true,
          },
          children: [
            {
              name: 'dataset-files',
              path: '',
              components: {
                stage: BfDatasetFiles
              },
              props: {
                stage: true,
              },
            },
            {
              name: 'collection-files',
              path: ':fileId',
              components: {
                stage: BfDatasetFiles
              },
              props: {
                stage: true,
              },
            },
            {
              name: 'file-record',
              path: ':fileId/details',
              components: {
                stage: FileDetails
              },
              meta: { showBackToFiles: true},
              props: {
                stage: true,
              },
            },
          ]

        },
        {
          name: 'publishing-settings',
          path: ':datasetId/publishing-settings',
          components: {
            stageHeader: SecondaryPageHeader,
            stage: BfPublishingSettings
          },
          props: true
        },
        {
          name: 'dataset-settings',
          path: ':datasetId/settings',
          components: {
            stageHeader: SecondaryPageHeader,
            stage: BfDatasetSettings,
          },
          props: {
            stage: true,
          }
        },
        {
          name: 'dataset-permissions',
          path: ':datasetId/permissions',
          components: {
            stageHeader: DatasetPermissionsHeader,
            stage: DatasetPermissionsView
          },
          redirect: {
            name: 'user-permissions'
          },
          props: {
            stage: true,
          },
          children: [
            {
              name: 'user-permissions',
              path: 'user',
              components: {
                stage: DatasetPermissions
              },
              props: {
                stage: true
              }
            },
            {
              name: 'embargo-permissions',
              path: 'embargo',
              components: {
                stage: EmbargoedPermissions
              },
              props: {
                stage: true
              }
            },
          ]
        },
        {
          name: 'metadata',
          path: ':datasetId/metadata',
          components: {
            stageHeader: DatasetMetadataHeader,
            stage: DatasetMetadataView
          },
          props: {
            stage: true,
            stageHeader: false
          },
          redirect: {
            name: 'records'
          },
          children: [
            {
              path: 'records',
              name: 'records',
              props: {
                stage: true
              },
              components: {
                stage: ModelRecords
              }
            },
            {
              path: 'record/:conceptId/:instanceId',
              name: 'metadata-record',
              props: true,
              meta: {
                headerAux: true
              },
              components: {
                // stage: ConceptInstance
              }
            },
            {
              path: 'models',
              name: 'models',
              props: {
                stage: true
              },
              components: {
                stage: Models
              }
            },
            {
              path: 'model/:conceptId',
              name: 'model',
              props: true,
              components: {
                // stage: ConceptManagement
              }
            },
            {
              path: 'relationships',
              name: 'relationships',
              props: {
                stage: true
              },
              components: {
                stage: RelationshipTypes
              }
            },
            {
              path: 'graph',
              name: 'graph',
              props: {
                stage: true
              },
              components: {
                // stage: GraphBrowser
              }
            },
          ]
        },
        {
          name: 'integrations-settings',
          path: ':datasetId/integrations-settings',
          components: {
            stageHeader: SecondaryPageHeader,
            stage: DatasetIntegrationsSettings
          },
          props: true
        },
        {
          name: 'dataset-activity',
          path: ':datasetId/activity',
          components: {
            stageHeader: DatasetActivityHeader,
            stage: DatasetActivityView
          },
          redirect: {
            name: 'activity-log'
          },
          props: {
            stage: true,
          },
          children: [
            {
              name: 'activity-log',
              path: 'logs',
              components: {
                stage: DatasetActivityLog
              },
              props: {
                stage: true
              }
            },
            {
              name: 'upload-manifests',
              path: 'manifests',
              components: {
                stage: DatasetManifests
              },
              props: {
                stage: true
              }
            },
          ]
        },
      ]
    },
    // {
    //   path: '/:orgId/datasets/:datasetId',
    //   components: {
    //     page: Dataset,
    //     navigation: BfNavigation,
    //     navigationSecondary: BfNavigationSecondary
    //   },
    //   children: [
    //     {
    //       name: 'dataset-overview',
    //       path: 'overview',
    //       components: {
    //         stage: DatasetOverview
    //       },
    //       props: {
    //         stage: true
    //       }
    //     },
    //   ]
    // },
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
        {
          name: 'team-members-list',
          path: ':id',
          components: {
            stage: TeamMembersList
          }
        },

      ],
      props: true
    },
    /**
     * Publishing routes
     */
    {
      name: 'publishing',
      path: '/:orgId/publishing',
      redirect: {
        name: PublicationTabs.REVIEW
      },
      components: {
        page: Publishing,
        navigation: BfNavigation
      },
      children: [
        {
          name: PublicationTabs.REVIEW,
          path: PublicationTabs.REVIEW,
          components: {
            stage: PublishingDatasetsList
          },
          props: {
            stage: {
              publicationStatus: [PublicationStatus.REQUESTED, PublicationStatus.ACCEPTED, PublicationStatus.FAILED],
            }
          }
        },
        {
          name: PublicationTabs.PUBLISHED,
          path: PublicationTabs.PUBLISHED,
          components: {
            stage: PublishingDatasetsList
          },
          props: {
            stage: {
              publicationStatus: [PublicationStatus.COMPLETED],
            }
          }
        },
        {
          name: PublicationTabs.REJECTED,
          path: PublicationTabs.REJECTED,
          components: {
            stage: PublishingDatasetsList
          },
          props: {
            stage: {
              publicationStatus: [PublicationStatus.REJECTED],
            }
          }
        },
        {
          name: PublicationTabs.PROPOSED,
          path: PublicationTabs.PROPOSED,
          components: {
            stage: PublishingProposalsList
          },
          props: {
            stage: {
              publicationStatus: [PublicationStatus.PROPOSED],
            }
          }
        }
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
    {
      name: 'invitation',
      path: '/invitation',
      components: {
        page: Invite
      },
      children: [
        {
          name: 'setup-profile-accept',
          path: 'accept/:username/:password',
          components: {
            stage: SetupProfile
          }
        },
        {
          name: 'verify-account',
          path: 'verify/:username/:password',
          components: {
            stage: FinalizeAccount
          }
        },
      ]
    },

  ],
});

export default router;
