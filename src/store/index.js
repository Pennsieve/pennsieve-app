import { createStore } from "vuex";
import Cookies from "js-cookie";
import * as site from "../site-config/site.json";
import * as R from "ramda";

import datasetModule from './datasetModule'
import integrationsModule from './integrationsModule'
import collectionsModule from './collectionsModule'
import viewerModule from './viewerModule'
import repositoryModule from "./repositoryModule"
import publishingModule from "./publishingModule"
import filesModule from "./filesModule";
import metadataModule from "./metadataModule";
import uploadModule from "./uploadModule";
import analysisModule from "./analysisModule";
import codeReposModule from "./codeReposModule";

const hashFunction = (key, list) => {
  const obj = {};
  list.forEach((item) => {
    if (item[key]) {
      obj[item[key]] = item;
    }
  });
  return obj;
};

// helpers
const getDataset = R.pathOr({}, ["detail", "dataset"]);
const getUploadDestination = R.propOr({}, "content");
// const getIndexByProp = (prop, match, list) => findIndex(propEq(prop, match), list)
const getDatasetIndex = (dataset, list) => {
  const datasetId = R.pathOr("", ["content", "id"], dataset);
  return R.findIndex(R.pathEq(["content", "id"], datasetId), list);
};

const initialFilterState = {
  filterName: "",
  filterOwner: "all-datasets",
  filterType: "datasets",
  sortBy: "content.name",
  sortDirection: "asc",
};

const initialState = () => ({
  config: site,
  uploadRemaining: 0,
  uploading: false,
  uploadCount: 0,
  hasGravatar: false,
  organizations: [],
  activeOrganization: {},
  activeOrgSynced: false,
  isLoadingDatasets: true,
  isLoadingDatasetsError: false,
  isLoadingDatasetBanner: true,
  isLoadingDatasetDoi: true,
  isLoadingDatasetDescription: true,
  isLoadingChangelog: true,
  isLoadingDatasetContributors: true,
  isLoadingDatasetIgnoreFiles: true,
  datasets: [],
  dataset: {},
  datasetEtag: "",
  datasetBanner: "",
  datasetDoi: {},
  datasetDescription: "",
  changelogText: "",
  datasetDescriptionEtag: "",
  datasetIgnoreFiles: [],
  datasetFilters: initialFilterState,
  datasetContributors: [],
  isDatasetOwner: false,
  datasetPublishedData: [],
  isLoadingDatasetPublishedData: false,
  orgMembers: [],
  orgContributors: [],
  teams: [],
  teamsLoading: true,
  publishers: [],
  publishersLoading: true,
  datasetRole: "viewer",
  primaryNavOpen: true,
  primaryNavCondensed: false,
  secondaryNavOpen: false,
  secondaryNavCondensed: false,
  editingInstance: false,
  concepts: [],
  conceptsHash: {},
  relationshipTypes: [],
  relationshipTypesHash: {},
  isLoadingConcepts: true,
  isLoadingRelationshipTypes: true,
  filesProxyId: "",
  sites: [],
  consortiumId: 1,
  consortiumDatasets: [],
  consortiumDatasetsImporting: [],
  modelTemplates: [],
  datasetTemplates: [],
  isLoadingDatasetTemplates: false,
  totalUploadSize: 0,
  bfTermsOfServiceVersion: "",
  environment: site.environment,
  viewerMontageScheme: "NOT_MONTAGED",
  bulkEditingChannels: false,
  orgDatasetStatuses: [],
  searchModalVisible: false,
  searchModalSearch: {},
  shouldCollapsePrimaryNav: false,
  scientificUnits: [],
  profile: {},
  pageNotFound: false,
  dataUseAgreements: [],
  cognitoUser: {},
  sessionTimer: null,
  isRefreshing: false,
  gitHubProfile: null,
  computeNodes: []
})

export const state = initialState();

export const mutations = {
    RESET_STATE(state) {
      Object.assign(state, initialState());
    },
    SET_IS_REFRESHING(state, data) {
      state.isRefreshing = data
    },
    SET_SESSION_TIMER(state, data) {
      state.sessionTimer = data
    },
      SET_ACTIVE_ORG_SYNC(state) {
        state.activeOrgSynced = true;
      },

      UPDATE_COGNITO_USER(state, data) {
        state.cognitoUser = data;
      },

      SET_PAGE_NOT_FOUND(state, data) {
        state.pageNotFound = data;
      },

      UPDATE_SCIENTIFIC_UNITS(state, data) {
        state.scientificUnits = data;
      },

      UPDATE_SEARCH_MODAL_SEARCH(state, data) {
        state.searchModalSearch = data;
      },

      UPDATE_SEARCH_MODAL_VISIBLE(state, data) {
        state.searchModalVisible = data;
      },

      UPDATE_SHOULD_COLLAPSE_PRIMARY_NAV(state, data) {
        state.shouldCollapsePrimaryNav = data;
      },


      UPDATE_ORG_MEMBERS(state, members) {
        state.orgMembers = members;
      },
      UPDATE_ACTIVE_ORGANIZATION(state, activeOrganization) {
        state.orgMembers = [];
        state.teams = [];
        state.activeOrganization = activeOrganization;
      },
      UPDATE_ORGANIZATIONS(state, organizations) {
        state.organizations = organizations;
      },
      UPDATE_PROFILE(state, profile) {
        const preferredOrgId = profile.preferredOrganization;
        const activeOrgId = R.pathOr(
            "",
            ["activeOrganization", "organization", "id"],
            state
        );
        const orgId = preferredOrgId ? preferredOrgId : activeOrgId;

        Cookies.set("preferred_org_id", orgId);
        state.profile = profile;
      },
      CLEAR_STATE(state) {
        state.profile = {};
        state.activeOrganization = {};
        state.organizations = {};
        state.orgMembers = [];
        state.concepts = [];
        state.teams = [];
        state.hasGravatar = true;
        state.dataset = {};
        state.datasets = [];
        state.datasetPublishedData = [];
        state.datasetDescription = "";
        state.changelogText = "";
        state.datasetDoi = "";
        state.datasetTemplates = [];
        state.searchModalVisible = false;
        state.cognitoUser = {};
        state.sessionTimer = null
      },
      UPDATE_CUR_DATASET(state, dataset) {
        state.curDataset = dataset;
      },
      UPDATE_UPLOAD_DESTINATION(state, uploadDestination) {
        state.uploadDestination = uploadDestination;
      },
      UPDATE_UPLOAD_STATUS(state, uploading) {
        state.uploading = uploading;
      },
      UPDATE_UPLOAD_REMAINING_ADD(state, size) {
        const totalRemaining = R.propOr(0, "uploadRemaining", state) + size;
        state.uploadRemaining = totalRemaining;
      },
      UPDATE_UPLOAD_REMAINING_REMOVE(state, size) {
        const totalRemaining = R.propOr(0, "uploadRemaining", state) - size;
        state.uploadRemaining = totalRemaining;
      },
      UPLOAD_COUNT_ADD(state, count) {
        const totalCount = R.propOr(0, "uploadCount", state) + count;
        state.uploadCount = totalCount;
      },
      UPLOAD_COUNT_REMOVE(state, count) {
        const totalCount = R.propOr(0, "uploadCount", state) - count;
        state.uploadCount = totalCount;
      },
      UPDATE_TOTAL_UPLOAD_SIZE(state, data) {
        const updatedSize = R.propOr(0, "totalUploadSize", state) + data;
        state.totalUploadSize = updatedSize;
      },
      UPDATE_UPLOAD_COUNT(state, data) {
        state.uploadCount = data;
      },
      TOGGLE_PRIMARY_NAV(state, open) {
        state.primaryNavOpen = open;
      },
      TOGGLE_SECONDARY_NAV(state, open) {
        state.secondaryNavOpen = open;
      },
      CONDENSE_PRIMARY_NAV(state, condensed) {
        state.primaryNavCondensed = condensed;
      },
      CONDENSE_SECONDARY_NAV(state, condensed) {
        state.secondaryNavCondensed = condensed;
      },
      UPDATE_HAS_GRAVATAR(state, hasGravatar) {
        state.hasGravatar = hasGravatar;
      },
      SET_DATASET(state, dataset) {
        state.dataset = dataset;

        const profileId = R.pathOr("", ["profile", "id"], state);
        const datasetId = R.prop("owner", dataset);
        const isDatasetOwner = profileId === datasetId;
        state.isDatasetOwner = isDatasetOwner;
      },
      SET_DATASET_ETAG(state, etag) {
        state.datasetEtag = etag;
      },
      SET_DATASET_BANNER(state, banner) {
        state.datasetBanner = banner;
      },
      UPDATE_TEAMS(state, teams) {
        state.teams = teams;
        state.teamsLoading = false;
      },
      UPDATE_PUBLISHERS(state, publishers) {
        state.publishers = publishers;
        state.publishersLoading = false;
      },
      // SET_LAST_ROUTE(state, route) {
      //   state.lastRoute = route;
      // },
      UPDATE_CONCEPTS(state, concepts) {
        state.concepts = concepts;
        state.conceptsHash = hashFunction("id", [...concepts]);
      },
      UPDATE_IS_LOADING_CONCEPTS(state, loading) {
        state.isLoadingConcepts = loading;
      },
      UPDATE_EDITING_INSTANCE(state, isEditing) {
        state.editingInstance = isEditing;
      },
      UPDATE_EXPLORE_FILES(state, exploreFiles) {
        state.exploreFiles = exploreFiles;
      },
      UPDATE_FILES_PROXY_ID(state, id) {
        state.filesProxyId = id;
      },
      ADD_CONSORTIUM_DATASET(state, dataset) {
        const consortiumDatasets = state.consortiumDatasets;
        consortiumDatasets.push(dataset)

      },
      UPDATE_CONSORTIUM_DATASETS(state, datasets) {
        state.consortiumDatasets = datasets;
      },
      REMOVE_CONSORTIUM_DATASET(state, dataset) {
        const discoverId = R.prop("consortiumDatasetId", dataset);
        if (discoverId) {
          const idx = R.findIndex(
              R.propEq("id", discoverId),
              state.consortiumDatasets
          );
          delete state.consortiumDatasets[idx];
        }
      },
      ADD_CONSORTIUM_DATASET_IMPORTING(state, dataset) {
        const consortiumDatasetsImporting = state.consortiumDatasetsImporting;
        consortiumDatasetsImporting.push(dataset)
      },
      REMOVE_CONSORTIUM_DATASET_IMPORTING(state, dataset) {
        const idx = R.findIndex(
            R.propEq("id", dataset.id),
            state.consortiumDatasetsImporting
        );
        delete state.consortiumDatasetsImporting[idx];
      },

      SET_DATASETS(state, data) {
        state.datasets = data;
      },

      UPDATE_DATASET(state, dataset) {
        const index = getDatasetIndex(dataset, state.datasets);

        state.dataset = dataset;

        if (index !== -1) {
          state.datasets[index] = dataset
        }
      },

      REMOVE_DATASET(state, dataset) {
        const index = getDatasetIndex(dataset, state.datasets);

        if (index) {
          delete state.datasets[index]
          dataset = {}
        }
      },

      ADD_DATASET(state, dataset) {
        const datasets = state.datasets;
        datasets.unshift(dataset)
      },

      SET_DATASET_PUBLISHED_DATA(state, data) {
        state.datasetPublishedData = data;
      },

      ADD_DATASET_PUBLISHED_DATA(state, data) {
        state.datasetPublishedData = data
      },

      UPDATE_DATASET_PUBLISHED_DATA(state, { data, getters }) {
        const sourceDatasetId = R.propOr(0, "sourceDatasetId", data);
        const idx = getters.getPublishedDataIndexByIntId(sourceDatasetId);
        state.datasetPublishedData[idx] = data

      },

      DELETE_DATASET_PUBLISHED_DATA(state, { data, getters }) {
        const sourceDatasetId = R.propOr(0, "sourceDatasetId", data);
        const idx = getters.getPublishedDataIndexByIntId(sourceDatasetId);

        delete state.datasetPublishedData[idx]
      },

      SET_IS_LOADING_DATASET_PUBLISHED_DATA(state, data) {
        state.isLoadingDatasetPublishedData = data;
      },

      SET_IS_LOADING_DATASETS(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasets = isLoading;
      },

      SET_IS_LOADING_DATASETS_ERROR(state, data) {
        const hasError = R.defaultTo(false, data);
        state.isLoadingDatasetsError = hasError;
      },

      SET_IS_LOADING_DATASET_BANNER(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasetBanner = isLoading;
      },

      SET_IS_LOADING_DATASET_DESCRIPTION(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasetDescription = isLoading;
      },

      SET_IS_LOADING_CHANGELOG(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingChangelog = isLoading;
      },

      SET_IS_LOADING_DATASET_CONTRIBUTORS(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasetContributors = isLoading;
      },

      SET_IS_LOADING_DATASET_IGNORE_FILES(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasetIgnoreFiles = isLoading;
      },

      SET_RELATIONSHIP_TYPES(state, data) {
        state.relationshipTypes = data;
        state.relationshipTypesHash = hashFunction("id", data);
      },

      ADD_RELATIONSHIP_TYPE(state, data) {
        state.relationshipTypes.push(data);
      },

      UPDATE_RELATIONSHIP_TYPE(state, relationship) {
        const idx = R.findIndex(
            R.propEq("id", relationship.id),
            state.relationshipTypes
        );
        state.relationshipTypes[idx] = relationship
      },

      DELETE_RELATIONSHIP_TYPE(state, relationship) {
        const idx = R.findIndex(
            R.propEq("id", relationship.id),
            state.relationshipTypes
        );
        delete state.relationshipTypes[idx]
      },

      UPDATE_IS_LOADING_RELATIONSHIP_TYPES(state, data) {
        state.isLoadingRelationshipTypes = data;
      },

      UPDATE_MODEL_TEMPLATES(state, data) {
        state.modelTemplates = data;
      },

      SET_DATASET_ROLE(state, data) {
        const role = R.propOr("viewer", "role", data);
        state.datasetRole = role;
      },

      SET_DATASET_TEMPLATES(state, datasetTemplates) {
        state.datasetTemplates = datasetTemplates;
      },

      ADD_DATASET_TEMPLATE(state, datasetTemplate) {
        const datasetTemplates = state.datasetTemplates;
        datasetTemplates.push(datasetTemplate)
      },

      REMOVE_DATASET_TEMPLATE(state, datasetTemplate) {
        const idx = R.findIndex(
            R.propEq("id", datasetTemplate.id),
            state.datasetTemplates
        );
        delete state.datasetTemplates[idx]
      },

      UPDATE_DATASET_TEMPLATES(state, datasetTemplate) {
        const idx = R.findIndex(
            R.propEq("id", datasetTemplate.id),
            state.datasetTemplates
        );
        state.datasetTemplates[idx] = datasetTemplate

      },

      SET_IS_LOADING_DATASET_TEMPLATES(state, data) {
        const isLoading = R.defaultTo(false, data);
        state.isLoadingDatasetTemplates = isLoading;
      },

      SET_BF_TERMS_OF_SERVICE_VERSION(state, data) {
        state.bfTermsOfServiceVersion = data;
      },

      SET_BULK_EDITING_CHANNELS(state, data) {
        state.bulkEditingChannels = data;
      },

      SET_DATASET_DESCRIPTION(state, data) {
        state.datasetDescription = data;
      },

      SET_CHANGELOG_TEXT(state, data) {
        state.changelogText = data;
      },

      SET_DATASET_DESCRIPTION_ETAG(state, etag) {
        state.datasetDescriptionEtag = etag;
      },

      SET_DATASET_IGNORE_FILES(state, data) {
        state.datasetIgnoreFiles = data;
      },

      SET_DATASET_DOI(state, data) {
        state.datasetDoi = data;
      },

      SET_IS_LOADING_DATASET_DOI(state, data) {
        state.isLoadingDatasetDoi = data;
      },

      SET_DATASET_FILTERS(state, data) {
        state.datasetFilters = data;
      },

      SET_DATASET_CONTRIBUTORS(state, contributors) {
        state.datasetContributors = contributors;
      },

      ADD_DATASET_CONTRIBUTOR(state, contributor) {
        state.datasetContributors.push(contributor);
      },

      UPDATE_DATASET_CONTRIBUTOR(state, contributor) {
        const idx = state.datasetContributors.findIndex((item) => {
          return item.id === contributor.id;
        });

        state.datasetContributors[idx] = contributor;
      },

      REMOVE_DATASET_CONTRIBUTOR(state, idx) {
        state.datasetContributors.splice(idx, 1);
      },

      SET_ORG_CONTRIBUTORS(state, contributors) {
        state.orgContributors = contributors;
      },

      ADD_ORG_CONTRIBUTOR(state, contributor) {
        state.orgContributors.push(contributor);
      },

      UPDATE_ORG_CONTRIBUTOR(state, contributor) {
        const idx = state.orgContributors.findIndex((item) => {
          return item.id === contributor.id;
        });

        state.orgContributors[idx] = contributor;
      },

      UPDATE_ORG_DATASET_STATUSES(state, data) {
        state.orgDatasetStatuses = data;
      },

      CLEAR_DATASET_FILTERS(state) {
        state.datasetFilters = initialFilterState;
      },

      UPDATE_DATA_USE_AGREEMENTS(state, data) {
        state.dataUseAgreements = data;
      },

      CREATE_DATA_USE_AGREEMENT(state, data) {
        state.dataUseAgreements.push(data);
      },

      REMOVE_DATA_USE_AGREEMENT(state, id) {
        const dataUseAgreements = state.dataUseAgreements.filter(
            (agreement) => agreement.id !== id
        );
        state.dataUseAgreements = dataUseAgreements;
      },

      UPDATE_DATA_USE_AGREEMENT(state, data) {
        const dataUseAgreements = state.dataUseAgreements.map((agreement) => {
          return agreement.id === data.id ? data : agreement;
        });
        state.dataUseAgreements = dataUseAgreements;
      },

      UPDATE_DEFAULT_DATA_USE_AGREEMENT(state, data) {
        const dataUseAgreements = state.dataUseAgreements.map((agreement) => {
          // If the agreement is the one to update, return the new agreement
          if (agreement.id === data.id) {
            return data;
            // If the agreement is the current default, make it not default
          } else if (agreement.isDefault) {
            return {
              ...agreement,
              isDefault: false,
            };
            // Do nothing and return the agreement
          } else {
            return agreement;
          }
        });
        state.dataUseAgreements = dataUseAgreements;
      },

      UPDATE_GITHUB_PROFILE(state, githubProfile) {
        state.gitHubProfile = githubProfile;
      },
    }

export const actions = {
  resetState({ commit }) {
    commit('resetState');
  },
  setIsRefreshing: ({ commit }, evt) => commit("SET_IS_REFRESHING", evt),
  setSessionTimer:  ({ commit }, evt) => commit("SET_SESSION_TIMER", evt),
  setActiveOrgSynced: ({ commit }) => commit("SET_ACTIVE_ORG_SYNC"),
  updateCognitoUser: ({ commit }, evt) => commit("UPDATE_COGNITO_USER", evt),
  updateGithubProfile: ({ commit }, evt) => commit("UPDATE_GITHUB_PROFILE", evt),
  updatePageNotFound: ({ commit }, evt) => commit("SET_PAGE_NOT_FOUND", evt),
  updateScientificUnits: ({ commit }, evt) =>
      commit("UPDATE_SCIENTIFIC_UNITS", evt),
  updateSearchModalSearch: ({ commit }, search) => {
    commit("UPDATE_SEARCH_MODAL_SEARCH", search);
  },

  updateSearchModalVisible: ({ commit, state }, isSearchModalVisible) => {
    commit("UPDATE_SEARCH_MODAL_VISIBLE", isSearchModalVisible);

    /*
     * Determine if the primary navigation should be uncollapsed
     * when closing the search dialog. If the menu starts collapsed
     * when the user opens search, do not uncollapsed it when search closes
     */
    if (isSearchModalVisible) {
      const shouldCollapsePrimaryNav = !state.primaryNavCondensed;
      commit("UPDATE_SHOULD_COLLAPSE_PRIMARY_NAV", shouldCollapsePrimaryNav);
    }

    if (state.shouldCollapsePrimaryNav) {
      commit("CONDENSE_PRIMARY_NAV", isSearchModalVisible);
    }
  },
  updateOrgMembers: ({ commit }, evt) => commit("UPDATE_ORG_MEMBERS", evt),
  updateOrgDatasetStatuses: ({ commit }, evt) =>
      commit("UPDATE_ORG_DATASET_STATUSES", evt),
  updateActiveOrganization: ({ commit }, evt) =>
      commit("UPDATE_ACTIVE_ORGANIZATION", evt),
  updateOrganizations: ({ commit }, evt) =>
      commit("UPDATE_ORGANIZATIONS", evt),
  updateProfile: ({ commit }, evt) => commit("UPDATE_PROFILE", evt),

  clearState: ({ commit }) => {
    commit("CLEAR_STATE");
    commit("viewerModule/CLEAR_STATE");
    commit("datasetModule/CLEAR_STATE");
  },
  updateCurDataset: ({ commit }, evt) =>
      commit("UPDATE_CUR_DATASET", getDataset(evt)),
  updateUploadDestination: ({ commit }, evt) =>
      commit("UPDATE_UPLOAD_DESTINATION", getUploadDestination(evt)),
  updateUploadStatus: ({ commit }, evt) =>
      commit("UPDATE_UPLOAD_STATUS", evt),
  updateUploadRemainingAdd: ({ commit }, evt) =>
      commit("UPDATE_UPLOAD_REMAINING_ADD", evt),
  updateUploadRemainingRemove: ({ commit }, evt) =>
      commit("UPDATE_UPLOAD_REMAINING_REMOVE", evt),
  uploadCountAdd: ({ commit }, evt) => commit("UPLOAD_COUNT_ADD", evt),
  uploadCountRemove: ({ commit }, evt) => commit("UPLOAD_COUNT_REMOVE", evt),
  togglePrimaryNav: ({ commit }, evt) => commit("TOGGLE_PRIMARY_NAV", evt),
  condensePrimaryNav: ({ commit }, evt) =>
      commit("CONDENSE_PRIMARY_NAV", evt),
  toggleSecondaryNav: ({ commit }, evt) =>
      commit("TOGGLE_SECONDARY_NAV", evt),
  condenseSecondaryNav: ({ commit }, evt) =>
      commit("CONDENSE_SECONDARY_NAV", evt),
  updateHasGravatar: ({ commit }, evt) => commit("UPDATE_HAS_GRAVATAR", evt),
  setDataset: ({ commit }, evt) => commit("SET_DATASET", evt),
  setDatasetEtag: ({ commit }, evt) => commit("SET_DATASET_ETAG", evt),
  setDatasetBanner: ({ commit }, evt) => commit("SET_DATASET_BANNER", evt),
  updateTeams: ({ commit }, evt) => commit("UPDATE_TEAMS", evt),
  updatePublishers: ({ commit }, evt) => commit("UPDATE_PUBLISHERS", evt),
  // setLastRoute: ({ commit }, evt) => commit("SET_LAST_ROUTE", evt),
  updateConcepts: ({ commit }, evt) => commit("UPDATE_CONCEPTS", evt),
  updateIsLoadingConcepts: ({ commit }, evt) =>
      commit("UPDATE_IS_LOADING_CONCEPTS", evt),
  updateEditingInstance: ({ commit }, evt) =>
      commit("UPDATE_EDITING_INSTANCE", evt),
  updateExploreFiles: ({ commit }, evt) =>
      commit("UPDATE_EXPLORE_FILES", evt),
  updateFilesProxyId: ({ commit }, evt) =>
      commit("UPDATE_FILES_PROXY_ID", evt),
  addConsortiumDataset: ({ commit }, evt) =>
      commit("ADD_CONSORTIUM_DATASET", evt),
  updateConsortiumDatasets: ({ commit }, evt) =>
      commit("UPDATE_CONSORTIUM_DATASETS", evt),
  removeConsortiumDataset: ({ commit }, evt) =>
      commit("REMOVE_CONSORTIUM_DATASET", evt),
  addConsortiumDatasetImporting: ({ commit }, evt) =>
      commit("ADD_CONSORTIUM_DATASET_IMPORTING", evt),
  removeConsortiumDatasetImporting: ({ commit }, evt) =>
      commit("REMOVE_CONSORTIUM_DATASET_IMPORTING", evt),
  setDatasets: ({ commit }, evt) => commit("SET_DATASETS", evt),
  updateDataset: ({ commit }, evt) => commit("UPDATE_DATASET", evt),
  removeDataset: ({ commit }, evt) => commit("REMOVE_DATASET", evt),
  addDataset: ({ commit }, evt) => commit("ADD_DATASET", evt),
  setDatasetPublishedData: ({ commit }, evt) =>
      commit("SET_DATASET_PUBLISHED_DATA", evt),
  addDatasetPublishedData: ({ commit }, evt) =>
      commit("ADD_DATASET_PUBLISHED_DATA", evt),
  updateDatasetPublishedData: ({ commit, getters }, data) =>
      commit("UPDATE_DATASET_PUBLISHED_DATA", { data, getters }),
  deleteDatasetPublishedData: ({ commit, getters }, data) =>
      commit("DELETE_DATASET_PUBLISHED_DATA", { data, getters }),
  setIsLoadingDatasetPublishedData: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_PUBLISHED_DATA", evt),
  setIsLoadingDatasets: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASETS", evt),
  setIsLoadingDatasetsError: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASETS_ERROR", evt),
  setIsLoadingDatasetBanner: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_BANNER", evt),
  setIsLoadingDatasetDescription: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_DESCRIPTION", evt),
  setIsLoadingChangelog: ({ commit }, evt) =>
      commit("SET_IS_LOADING_CHANGELOG", evt),
  setIsLoadingDatasetContributors: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_CONTRIBUTORS", evt),
  setIsLoadingDatasetIgnoreFiles: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_IGNORE_FILES", evt),
  setRelationshipTypes: ({ commit }, evt) =>
      commit("SET_RELATIONSHIP_TYPES", evt),
  addRelationshipType: ({ commit }, evt) =>
      commit("ADD_RELATIONSHIP_TYPE", evt),
  updateRelationshipType: ({ commit }, evt) =>
      commit("UPDATE_RELATIONSHIP_TYPE", evt),
  deleteRelationshipType: ({ commit }, evt) =>
      commit("DELETE_RELATIONSHIP_TYPE", evt),
  updateIsLoadingRelationshipTypes: ({ commit }, evt) =>
      commit("UPDATE_IS_LOADING_RELATIONSHIP_TYPES", evt),
  updateModelTemplates: ({ commit }, evt) =>
      commit("UPDATE_MODEL_TEMPLATES", evt),
  setDatasetRole: ({ commit }, evt) => commit("SET_DATASET_ROLE", evt),
  setDatasetTemplates: ({ commit }, evt) =>
      commit("SET_DATASET_TEMPLATES", evt),
  addDatasetTemplate: ({ commit }, evt) =>
      commit("ADD_DATASET_TEMPLATE", evt),
  removeDatasetTemplate: ({ commit }, evt) =>
      commit("REMOVE_DATASET_TEMPLATE", evt),
  updateDatasetTemplates: ({ commit }, evt) =>
      commit("UPDATE_DATASET_TEMPLATES", evt),
  setIsLoadingDatasetTemplates: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_TEMPLATES", evt),
  updateTotalUploadSize: ({ commit }, evt) =>
      commit("UPDATE_TOTAL_UPLOAD_SIZE", evt),
  updateUploadCount: ({ commit }, evt) => commit("UPDATE_UPLOAD_COUNT", evt),
  setBfTermsOfServiceVersion: ({ commit }, evt) =>
      commit("SET_BF_TERMS_OF_SERVICE_VERSION", evt),
  setBulkEditingChannels: ({ commit }, evt) =>
      commit("SET_BULK_EDITING_CHANNELS", evt),
  setDatasetDescription: ({ commit }, evt) =>
      commit("SET_DATASET_DESCRIPTION", evt),
  setChangelogText: ({ commit }, evt) => commit("SET_CHANGELOG_TEXT", evt),
  setDatasetDescriptionEtag: ({ commit }, evt) =>
      commit("SET_DATASET_DESCRIPTION_ETAG", evt),
  setDatasetIgnoreFiles: ({ commit }, evt) =>
      commit("SET_DATASET_IGNORE_FILES", evt),
  setDatasetDoi: ({ commit }, evt) => commit("SET_DATASET_DOI", evt),
  setIsLoadingDatasetDoi: ({ commit }, evt) =>
      commit("SET_IS_LOADING_DATASET_DOI", evt),
  setDatasetFilters: ({ commit }, evt) => commit("SET_DATASET_FILTERS", evt),
  setDatasetContributors: ({ commit }, evt) =>
      commit("SET_DATASET_CONTRIBUTORS", evt),
  addContributor: ({ commit }, contributor) => {
    commit("ADD_DATASET_CONTRIBUTOR", R.clone(contributor));
  },

  updateDatasetContributor: ({ commit }, contributor) => {
    commit("UPDATE_DATASET_CONTRIBUTOR", R.clone(contributor));
    commit("UPDATE_ORG_CONTRIBUTOR", R.clone(contributor));
  },
  removeContributor: ({ commit, state }, id) => {
    const idx = R.findIndex(R.propEq("id", id), state.datasetContributors);

    if (idx >= 0) {
      commit("REMOVE_DATASET_CONTRIBUTOR", idx);
    } else {
      return Promise.reject(id);
    }
  },
  setOrgContributors: ({ commit }, evt) =>
      commit("SET_ORG_CONTRIBUTORS", evt),
  addOrgContributor: ({ commit }, contributor) => {
    commit("ADD_ORG_CONTRIBUTOR", R.clone(contributor));
  },
  clearDatasetFilters: ({ commit }) => commit("CLEAR_DATASET_FILTERS"),
  updateDataUseAgreements: ({ commit }, evt) =>
      commit("UPDATE_DATA_USE_AGREEMENTS", evt),
  createDataUseAgreement: ({ commit }, evt) =>
      commit("CREATE_DATA_USE_AGREEMENT", evt),
  removeDataUseAgreement: ({ commit }, evt) =>
      commit("REMOVE_DATA_USE_AGREEMENT", evt),
  updateDataUseAgreement: ({ commit }, evt) =>
      commit("UPDATE_DATA_USE_AGREEMENT", evt),
  updateDefaultDataUseAgreement: ({ commit }, evt) =>
      commit("UPDATE_DEFAULT_DATA_USE_AGREEMENT", evt),
}

export const getters = {

  // NOTE: Getters need to have a different name than the state property. The syntax should be `getStatePropertyName` not `statePropertyName.`

  // NOTE: Getters are used for manipulating data, not just reading it. If simple reading global state, use mapState instead of mapGetters.

  // TODO: Refactor usages of these simple data-accessing getters so the state property is accessed from mapState.

  sessionTimer: (state) => state.sessionTimer,
  isRefreshing: (state) => state.isRefreshing,
  isWelcomeOrg: state => {
    const featuresList = R.pathOr([], ['activeOrganization', 'organization', 'features'], state)
    return R.includes('sandbox_org_feature', featuresList)
  },
  isOrgSynced: (state) => state.activeOrgSynced,
  config: (state) => state.config,
  profile: (state) => state.profile,
  getProfile: (state) => () => state.profile,
  organizations: (state) => state.organizations,
  activeOrganization: (state) => state.activeOrganization,
  getActiveOrganization: (state) => () => state.activeOrganization,
  orgMembers: (state) => state.orgMembers,
  getCognitoUser: (state) => state.cognitoUser,
  getOrgMembers: (state) => () => state.orgMembers,
  getOrgMember: (state) => (id) => {
    return R.defaultTo({}, R.find(R.propEq("id", id), state.orgMembers));
  },
  getOrgMemberByIntId: (state) => (id) => {
    for (let i = 0; i < state.orgMembers; i++) {
     if (state.orgMembers[i].intId === id ) {
       return state.orgMembers[i]
     }
    }
    return null


    // return R.defaultTo({}, R.find(R.propEq("intId", id), state.orgMembers));
  },
  getModelByHash: (state) => (id) => {
    return state.conceptsHash[id]
  },
  getOrgMembersById: (state) => (list) => {
    return state.orgMembers.filter((member) => list.includes(member.id));
  },
  getOrgMembersByIntId: (state) => (list) => {
    return state.orgMembers.filter((member) => list.includes(member.intId));
  },
  getTeam: (state) => (id) => {
    return R.defaultTo({}, R.find(R.pathEq(["team", "id"], id), state.teams));
  },
  uploadCount: (state) => state.uploadCount,
  uploading: (state) => state.uploading,
  uploadRemaining: (state) => state.uploadRemaining,
  getPrimaryNavOpen: (state) => () => state.primaryNavOpen,
  primaryNavOpen: (state) => state.primaryNavOpen,
  getSecondaryNavOpen: (state) => () => state.secondaryNavOpen,
  hasGravatar: (state) => state.hasGravatar,
  uploadDestination: (state) => state.uploadDestination,
  dataset: (state) => state.dataset,
  getDataset: (state) => () => state.dataset,
  getDatasetById: (state) => (id) => {
    return R.find(R.pathEq(["content", "id"], id), state.datasets);
  },
  getDatasetByIntId: (state) => (intId) => {
    return R.find(R.pathEq(["content", "intId"], intId), state.datasets);
  },
  isDatasetOwner: (state) => state.isDatasetOwner,
  teams: (state) => state.teams,
  // lastRoute: (state) => state.lastRoute,
  // getLastRoute: (state) => () => state.lastRoute,
  concepts: (state) => state.concepts,
  isLoadingConcepts: (state) => state.isLoadingConcepts,
  editingInstance: (state) => state.editingInstance,
  exploreFiles: (state) => state.exploreFiles,
  hasFeature: (state) => (featureName) => {
    const featuresList = R.pathOr(
        [],
        ["activeOrganization", "organization", "features"],
        state
    );
    return R.includes(featureName, featuresList);
  },
  getModelById: (state) => (modelId) => {
    return R.find(R.propEq("id", modelId), state.concepts);
  },
  getModelByName: (state) => (modelName) => {
    return R.find(R.propEq("name", modelName), state.concepts);
  },
  getModelCount: (state) => (modelName) =>
      R.compose(
          R.propOr(0, "count"),
          find(R.propEq("name", modelName))
      )(state.concepts),
  filesProxyId: (state) => state.filesProxyId,
  getFilesProxyId: (state) => () => state.filesProxyId,
  getConsortiumDataset: (state) => (datasetId) =>
      R.compose(
          R.defaultTo({}),
          find(R.propEq("id", datasetId))
      )(state.consortiumDatasets),
  getConsortiumDatasetImporting: (state) => (datasetId) =>
      R.compose(
          R.defaultTo({}),
          R.find(R.propEq("id", datasetId))
      )(state.consortiumDatasetsImporting),
  getOrganizationByIntId: (state) => (id) => {
    console.log(state.organizations)
    for (let i = 0; i < state.organizations; i++) {
      console.log(id)
      if (state.organizations[i].organization.intId === id ) {
        return state.organizations[i]
      }
    }
    return {}

  },
  getRelationshipTypes: (state) => () => state.relationshipTypes,
  getRelationshipTypeByName: (state) => (name) => {
    return R.compose(
        R.defaultTo({}),
        R.find(R.propEq("name", name))
    )(state.relationshipTypes);
  },
  totalRecordsCount: (state) =>
      R.compose(R.sum, R.pluck("count"), R.defaultTo([]))(state.concepts),
  modelsCount: (state) => R.compose(length, R.defaultTo([]))(state.concepts),
  getMostUsedModels:
      (state) =>
          (count = 5) => {
            const sortByProp = (a, b) => {
              return b.count - a.count;
            };
            const filterEmpty = R.filter((model) => model.count > 0);

            return R.compose(
                R.take(count),
                R.sort(sortByProp),
                filterEmpty(),
                R.defaultTo([])
            )(state.concepts);
          },
  getRelationshipTypeDisplayName: (state) => (name) => {
    return R.compose(
        R.propOr("", "displayName"),
        R.find(R.propEq("name", name))
    )(state.relationshipTypes);
  },
  modelTemplates: (state) => () => state.modelTemplates,
  getPermission:
      (state) =>
          (role = "manager") => {
            const roles = {
              owner: 3,
              manager: 2,
              editor: 1,
              viewer: 0,
            };
            return roles[state.datasetRole] >= roles[role];
          },
  getDatasetRole: (state) => () => state.datasetRole,
  getPublishedDataByIntId: (state) => (id) => {
    return R.defaultTo(
        {},
        find(R.propEq("sourceDatasetId", id), state.datasetPublishedData)
    );
  },
  getPublishedDataIndexByIntId: (state) => (id) => {
    return R.defaultTo(
        {},
        R.findIndex(R.propEq("sourceDatasetId", id), state.datasetPublishedData)
    );
  },
  datasetOwner: (state, getters) => {
    const ownerId = R.propOr("", "owner", state.dataset);

    return getters.getOrgMember(ownerId);
  },
  isUserDatasetOwner: (state) => (dataset) => {
    return state.profile.id === dataset.owner;
  },
  hasOrcidId: (state) => {
    return R.pathOr(false, ["profile", "orcid", "orcid"], state);
  },
  hasGitHubId: (state) => {
    return R.pathOr(false, ["gitHubProfile"], state);
  },
  publishToOrcid:(state)=>{
    return state.profile.orcid.scope && state.profile.orcid.scope[1] && state.profile.orcid.scope[1]==='/activities/update';
  },
  datasetOwnerHasOrcidId: (state, getters) => {
    const owner = getters.datasetOwner;
    return R.pathOr(false, ["orcid", "orcid"], owner).length > 0;
  },
  isUserSuperAdmin: (state) => {
    return state.profile.isSuperAdmin === true;
  },
  isUserPublisher: (state) => {
    return state.publishers.map((p) => p.id).includes(state.profile.id);
  },
  datasetLocked: (state) => {
    return state.dataset.locked;
  },
  publisherTeam: (state) =>
      state.teams
          .map((t) => t.team)
          .find((t) => t.systemTeamType === "publishers"),
  datasetIntId: (state) => {
    return state.dataset.content ? state.dataset.content.intId : null;
  },
  getComputeNodes: (state) => {
    return state.computeNodes
  }
}




export default createStore({
  state: state,
  mutations: mutations,
  actions: actions,
  getters: getters,
  modules: {
    datasetModule,
    integrationsModule,
    collectionsModule,
    viewerModule,
    repositoryModule,
    publishingModule,
    filesModule,
    uploadModule,
    metadataModule,
    analysisModule,
    codeReposModule
  }

});
