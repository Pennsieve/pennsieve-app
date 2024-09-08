import { createRouter, createWebHistory } from "vue-router";
import { PublicationStatus, PublicationTabs } from '../utils/constants.js'
import DatasetActivityView from "./Dataset/DatasetActivityView.vue";
import DatasetPermissionsView from "./Dataset/DatasetPermissionsView.vue";
import DatasetMetadataHeader from "./Dataset/DatasetMetadataHeader.vue";
import DatasetMetadataView from "./Dataset/DatasetMetadataView.vue";
import DatasetMetadataModelsView from "./Dataset/DatasetMetadataModelsView.vue";
import AboutPennsieve from "./AboutPennsieve/AboutPennsieve.vue";
import GettingHelpStage from "../components/GettingHelp/GettingHelpStage.vue";

import NotFound from './not-found/NotFound.vue'
import GraphBrowse2 from "@/components/datasets/records/GraphBrowser/GraphBrowse2.vue";
const ResetPassword = () => import('./ResetPassword/ResetPassword.vue')
const DocsLogin = () => import('./DocsLogin/DocsLogin.vue')

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
const Invite = () => import('./Invite/Invite.vue')
const SetupProfile = () => import('../components/SetupProfile/SetupProfile.vue')
const SetupFederatedLogin = () => import('../components/SetupFederatedLogin/SetupFederatedLogin.vue')
const FinalizeAccount = () => import('../components/FinalizeAccount/FinalizeAccount.vue')
const PennsieveInfo = () => import('../components/welcome/Info.vue')

const WelcomePage = () => import('./welcomePage/WelcomePage.vue')
const WelcomeInfo = () => import('../components/welcome/Welcome.vue')
const SubmitDatasetPage = () => import('./welcomePage/SubmitDatasetPage.vue')
const TermsOfService = () => import('./TermsOfService/TermsOfService.vue')
const SubmitDatasets = () => import('../components/welcome/SubmitDatasets.vue')
const CreateAccount = () => import('./CreateAccount/CreateAccount.vue')
const DeveloperTools = () => import('../components/welcome/DeveloperTools.vue')

const Viewer = () => import('../components/viewer/PsViewer/PsViewer.vue')

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
const Integrations = () => import ('./Integrations/Integrations.vue')
const IntegrationsList = () => import ('../components/Integrations/IntegrationsList/IntegrationsList.vue')
const ApplicationsList = () => import ('../components/Integrations/applicationsList/ApplicationsList.vue')
const ComputeNodesList = () => import ('../components/Integrations/ComputeNodesList/ComputeNodesList.vue')

/**
 * Metadata Components
 */
// const DatasetRecords = () => import('../components/datasets/records/DatasetRecords/DatasetRecords.vue')
const ModelRecords = () => import('../components/datasets/explore/search/ModelRecords.vue')
const Models = () => import('../components/datasets/management/GraphManagement/Models.vue')
const RelationshipTypes = () => import('../components/datasets/management/GraphManagement/RelationshipTypes.vue')
const GraphBrowser = () => import('../components/datasets/records/GraphBrowser/GraphBrowser.vue')
const ModelInstance = () => import('../components/datasets/management/ConceptManagement/ConceptManagement.vue')
const ConceptInstance = () => import('../components/datasets/explore/ConceptInstance/ConceptInstance.vue')
const InstanceEdit = () => import('../components/datasets/explore/ConceptInstance/InstanceEdit.vue')

/**
 * 404
 */
const PS404 = () => import('../components/PS-404/PS-404.vue')

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
      name: 'docs-login',
      path: '/docs-login',
      components: {
        page: DocsLogin
      }
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
      name: 'viewer',
      path: '/:orgId/datasets/:datasetId/viewer/:fileId',
      components: {
        page: Viewer
      },
      props: true
    },
    {
      name: "create-account",
      path: "/sign-up",
      components: {
        page: CreateAccount
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
    {
      path:'/:orgId/welcome/terms-of-service',
      name:'terms-of-service',
      components: {
          page: TermsOfService
      },
    },
    {
      path: "/:orgId/pennsieve",
      name: "about-pennsieve",
      components: {
        page: AboutPennsieve,
        navigation: BfNavigation
      },
      props: true,
      redirect: {
        name: 'info'
      },
      children: [
        {
          name: 'welcome',
          path: 'welcome',
          components: {
            stage: WelcomeInfo
          }
        },
        {
          name: 'support',
          path: 'support',
          components: {
            stage: GettingHelpStage
          }
        },
        {
          name: 'info',
          path: 'info',
          components: {
            stage: PennsieveInfo
          }
        },
        {
          name: 'developer-tools',
          path: 'developer',
          components: {
            stage: DeveloperTools
          }
        },
      ]
    },
    // /**
    //  * Information Panel for organization
    //  */
    // {
    //   path: '/:orgId/user',
    //   components: {
    //     page: WelcomePage,
    //     navigation: BfNavigation
    //   },
    //   props: true,
    //   children: [
    //
    //     {
    //       name: 'info',
    //       path: '',
    //       components: {
    //         stage: WelcomePage
    //       }
    //     },
    //   ],
    // },
    /**
     * Welcome Org routes
     */
    {
      path: '/:orgId/overview',
      name: 'user-overview',
      components: {
        page: WelcomePage,
        navigation: BfNavigation
      },
      props: {
        page: true,
        navigation: true,
      },
      redirect: {
        name: 'my-settings-container'
      },
      children: [

        {
          name: 'my-settings-container',
          path: '/:orgId/profile',
          components: {
            stage: MySettingsContainer
          }
        },
        {
          name: 'submit',
          path: '/:orgId/submit',
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
          name: 'dataset-overview-redirect',
          path: ':datasetId',
          redirect: {
            name: 'dataset-overview'
          }
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
              meta: { helpSection: 'files-tab'},
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
            stageHeader: true
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
              path: 'record/:modelId/:instanceId',
              name: 'metadata-record',
              props: true,
              meta: {
                backLink: {name: "Records", to: "records"},
                headerAux: true
              },
              components: {
                stage: ConceptInstance
              }
            },
            {
              path: 'record/:modelId/:instanceId/edit',
              name: 'metadata-record-edit',
              props: true,
              meta: {
                backLink: {name: "Records", to: "metadata-record"},
                headerAux: true
              },
              components: {
                stage: InstanceEdit
              }
            },
            {
              path: 'models',
              name: 'models',
              props: {
                stage: true
              },
              components: {
                stage: DatasetMetadataModelsView
              },
              redirect: {
                name: 'models-list'
              },
              children: [
                {
                  path: 'list',
                  name: 'models-list',
                  props: true,
                  components: {
                    stage: Models
                  }
                },
                {
                  path: 'details/:modelId',
                  name: 'model-details',
                  props: true,
                  meta: { backLink: {name: "Models", to: "models-list"}},
                  components: {
                    stage: ModelInstance
                  }
                },
              ]
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
                stage: GraphBrowse2
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
      name: 'analysis',
      path: '/:orgId/analysis',
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
        {
          name: 'compute-nodes',
          path: 'compute-nodes',
          components: {
            stage: ComputeNodesList,
          },
          props: true
        }
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
      path: '/invitation',
      name: 'invitation',
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
          name: 'complete-profile-accept',
          path: 'complete/:username/:password',
          components: {
            stage: SetupProfile
          }
        },
        {
          name: 'federated-sign-up',
          path: '/:orgId/welcome/federated-sign-up',
          components: {
            stage: SetupFederatedLogin
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



    {
      name: 'password',
      path: '/password',
      components: {
        page: ResetPassword
      },
      props: {
        page: (route) => {
          return { resetToken: route.query.resetToken }
        }
      }
    },

    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      components: {
        page: NotFound,
      },
      redirect: {
        name: 'page-not-found'
      },
      children: [
        {
          name: 'page-not-found',
          path: '',
          components: {
            stage: PS404
          }
        },
      ],
      props: true
    },



  ],
});

export default router;
