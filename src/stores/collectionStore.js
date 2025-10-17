import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { useGetToken } from "@/composables/useGetToken.js";
import { useSendXhr } from "@/mixins/request/request_composable.js";
import * as siteConfig from "@/site-config/site.json";

export const useCollectionsStore = defineStore("collectionsStore", () => {
  //collections state
  const userCollections = ref([]);
  const publicCollections = ref([]);
  const publicDatasetDOIs = ref([]);
  const limit = ref(0);
  const offset = ref(10);
  const totalCount = ref(0);

  const targetCollectionDatasets = ref([]); //single collection and datasets being selected
  const versionHistory = ref([]);

  const collectionStatus = ref(new Map());
  collectionStatus.value.set("PUBLISH_SUCCEEDED", "PUBLISHED");

  const clearCollectionsStore = () => {
    userCollections.value = [];
    publicCollections.value = [];
    limit.value = 0;
    offset.value = 10;
    totalCount.value = 0;
    targetCollectionDatasets.value = [];
    versionHistory.value = [];
  };

  /*
  CREATE new collection
  POST
  */
  const createNewCollection = async (body) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/`;
      const response = await useSendXhr(url, {
        method: "POST",
        header: {
          Authorization: `Bearer ${token}`,
        },
        body: body,
      });
      return response.nodeId;
    } catch (error) {
      console.error("failed to create new colleciton", error);
    }
  };
  /*
EDIT collections call PATCH
*/
  const editCollection = async (collectionID, body) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/${collectionID}`;
      const response = await useSendXhr(url, {
        method: "PATCH",
        header: {
          Authorization: `Bearer ${token}`,
        },
        body: body,
      });
      return response;
    } catch (exception) {
      console.error("Edit collection failed", error);
      throw error;
    }
  };
  /*
PUBLISH collections call POST
*/
  const publishCollection = async ({ nodeId, tags, license }) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/${nodeId}/publish`;
      const response = await useSendXhr(url, {
        method: "POST",
        header: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          license: license,
          tags: tags,
        },
      });
      return response?.publishedDatasetId;
    } catch (error) {
      console.error("failed to publish colleeciton", error);
    }
  };
  /*
  GET call for collections that a user owns
  */
  const getUserCollections = async (
    customOffset = offset.value,
    customLimit = limit.value
  ) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/`;
      const response = await useSendXhr(url, {
        method: "GET",
        header: {
          Authorization: `Bearer ${token}`,
        },
      });

      userCollections.value = response.collections
        .map((item) => ({
          id: item.nodeId,
          name: item.name,
          state: item.publication.status,
          description: item.description,
          datasetCount: item.size,
          userRole: item.userRole,
          banners: item.banners,
          tags: item.tags,
          license: item.license,
        }))
        .reverse();
      totalCount.value = response.totalCount || 0;
      return userCollections.value;
    } catch (error) {
      console.error("failed to get user's collections", error);
    }
  };
  /*
  GET call for collections public collections
  */
  const getPublicCollections = async (
    customLimit = limit.value,
    customOffset = offset.value
  ) => {
    const url = `${siteConfig.discoverUrl}/discover/datasets?limit=${customLimit}&offset=${customOffset}&datasetType=collection&orderBy=relevance&orderDirection=desc`;
    const response = await useSendXhr(url, {
      method: "GET",
    });
    if (!response.datasets) {
      return;
    }
    publicCollections.value = response.datasets.map((item) => ({
      id: item.id,
      doi: item.doi,
      name: item.name,
      description: item.description,
      datasetCount: item.doiCollection.size,
      size: item.size,
      userRole: item.userRole,
      banners: item.doiCollection.banners,
      state: collectionStatus.value.get(item.status),
      tags: item.tags,
      ownerFirstName: item.ownerFirstName,
      ownerLastName: item.ownerLastName,
      ownerOrcid: item.ownerOrcid,
      license: item.license,
    }));
    totalCount.value = response.totalCount || 0;
  };
  /*
  GET call for all details about a collection by collectionID
  */
  const getCollectionDetails = async (collectionID) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/${collectionID}?includePublishedDataset=true`;
      const response = await useSendXhr(url, {
        method: "GET",
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      const transformed = {
        id: response.nodeId,
        name: response.name,
        description: response.description,
        datasetCount: response.size,
        userRole: response.userRole,
        banners: response.banners,
        datasets: response.datasets,
        contributors: response.derivedContributors,
        publication: response.publication,
        userRole: response.userRole,
        tags: response.tags,
        license: response.license,
      };
      targetCollectionDatasets.value = transformed;
      return transformed;
    } catch (error) {
      console.error("Failed to Get Colleciton Details", error);
    }
  };

  /*
  GET Collections details for PUBLISHED collections
  */
  const getPublishedCollectionDetails = async (collectionID) => {
    try {
      const url = ` ${siteConfig.discoverUrl}/discover/datasets/${collectionID}`;
      const response = await useSendXhr(url, {
        method: "GET",
      });
      const transformed = {
        id: response.id,
        doi: response.doi,
        name: response.name,
        uri: response.uri,
        description: response.description,
        datasetCount: response.doiCollection.size,
        banners: response.doiCollection.banners,
        datasets: response.datasets,
        state: collectionStatus.value.get(response.status),
        version: response.version,
        publishedPage: true,
        contributors: response.contributors,
        tags: response.tags,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        versionPublishedAt: response.versionPublishedAt,
        firstPublishedAt: response.firstPublishedAt,
        revisedAt: response.revisedAt,
        ownerFirstName: response.ownerFirstName,
        ownerLastName: response.ownerLastName,
        ownerOrcid: response.ownerOrcid,
        ownerId: response.ownerId,
        userRole: response.userRole,
      };

      targetCollectionDatasets.value = transformed;
      getPublishedCollectionDOIs(response.id, response.version, 0, 25);
      getVersionsOfCollection(response.id);
    } catch (error) {
      console.error("Failed to Get Colleciton Details", error);
    }
  };
  /*
  GET Collections DOIs for PUBLISHED collections
  */
  const getPublishedCollectionDOIs = async (
    collectionID,
    version,
    offset,
    limit
  ) => {
    try {
      const url = `${siteConfig.discoverUrl}/discover/datasets/${collectionID}/versions/${version}/dois?limit=${limit}&offset=${offset}`;
      const response = await useSendXhr(url, {
        method: "GET",
      });
      const transformed = {};
      targetCollectionDatasets.value.datasets = response.dois;
    } catch (error) {
      console.error("Failed to Get Colleciton DOIs", error);
    }
  };
  const getVersionsOfCollection = async (collectionID) => {
    try {
      const url = `${siteConfig.discoverUrl}/discover/datasets/${collectionID}/versions`;
      const response = await useSendXhr(url, {
        method: "GET",
      });
      versionHistory.value = response;
    } catch (e) {
      console.error("failed to get collection Version", e);
    }
  };
  /*
  DELETE call for collection by collection id
  */
  const deleteCollection = async (collectionID) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/${collectionID}`;
      const response = await useSendXhr(url, {
        method: "DELETE",
        header: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response;
    } catch (error) {
      console.error("Delete collection failed:", error);
      throw error;
    }
  };

  const editCollectionDataset = async (collectionID, add, remove) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.api2Url}/collections/${collectionID}`;

      const dois = {};
      if (add && add.length > 0) {
        dois.add = add;
      }
      if (remove && remove.length > 0) {
        dois.remove = remove;
      }
      const response = await useSendXhr(url, {
        method: "PATCH",
        header: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          dois: dois,
        },
      });
    } catch (exception) {
      console.error("editing collection's datasets failed", exception);
      throw exception;
    }
  };

  // Dataset collections management
  const datasetCollections = ref([]);
  const collections = computed(() => userCollections.value);

  const fetchCollections = async () => {
    return getUserCollections();
  };

  const fetchDatasetCollections = async (datasetId) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.discoverUrl}/datasets/${datasetId}/collections?api_key=${token}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const collections = await response.json();
        datasetCollections.value = collections;
        return collections;
      } else {
        throw new Error(response.statusText);
      }
    } catch (err) {
      console.error("Error fetching dataset collections:", err);
      throw err;
    }
  };

  const addCollection = async ({ datasetId, collectionId }) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.discoverUrl}/datasets/${datasetId}/collections?api_key=${token}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ collectionId }),
      });

      if (response.ok) {
        const collections = await response.json();
        datasetCollections.value = collections;
        return collections;
      } else {
        throw new Error(response.statusText);
      }
    } catch (err) {
      console.error("Error adding collection:", err);
      throw err;
    }
  };

  const removeCollection = async ({ datasetId, collectionId }) => {
    try {
      const token = await useGetToken();
      const url = `${siteConfig.discoverUrl}/datasets/${datasetId}/collections/${collectionId}?api_key=${token}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Remove from local state
        datasetCollections.value = datasetCollections.value.filter(
          (c) => c.id !== collectionId
        );
        // Refresh the main collections list in case this collection was deleted entirely
        await getUserCollections();
        return true;
      } else {
        throw new Error(response.statusText);
      }
    } catch (err) {
      console.error("Error removing collection:", err);
      throw err;
    }
  };

  const createCollection = async ({ datasetId, collectionName }) => {
    try {
      // First create the collection using existing method
      const newCollection = await createNewCollection(collectionName, "");

      // Then add it to the dataset if datasetId provided
      if (datasetId) {
        await addCollection({ datasetId, collectionId: newCollection.id });
      }

      return newCollection;
    } catch (err) {
      console.error("Error creating collection:", err);
      throw err;
    }
  };

  // Method to load public datasets from discover API for dataset selection
  const getPublicDatasets = async (limit = 25, offset = 0) => {
    try {
      const url = `${siteConfig.discoverUrl}/datasets?limit=${limit}&offset=${offset}&datasetType=research&embargo=false`;
      const response = await useSendXhr(url, {
        method: "GET",
        header: {
          "Content-Type": "application/json",
        },
      });

      if (response && response.datasets) {
        const transformedDatasets = response.datasets.map((dataset) => ({
          id: dataset.id,
          sourceDatasetId: dataset.sourceDatasetId,
          name: dataset.name,
          description: dataset.description || "",
          banner: dataset.banner || "",
          size: dataset.size || 0,
          fileCount: dataset.fileCount || 0,
          recordCount: dataset.recordCount || 0,
          owner: `${dataset.ownerFirstName || ""} ${
            dataset.ownerLastName || ""
          }`.trim(),
          organizationName: dataset.organizationName || "",
          updatedAt:
            dataset.updatedAt ||
            dataset.revisedAt ||
            dataset.versionPublishedAt,
          doi: dataset.doi,
          version: dataset.version,
          revision: dataset.revision,
          tags: dataset.tags || [],
          license: dataset.license,
        }));

        return {
          datasets: transformedDatasets,
          totalCount: response.totalCount || 0,
        };
      }

      return { datasets: [], totalCount: 0 };
    } catch (error) {
      console.error("Error loading public datasets:", error);
      throw error;
    }
  };

  // Method to search datasets using the discover API search endpoint
  const searchDatasets = async (query, limit = 25, offset = 0) => {
    try {
      const token = await useGetToken();
      const url = `${
        siteConfig.discoverUrl
      }/search/datasets?limit=${limit}&offset=${offset}&query=${encodeURIComponent(
        query
      )}&api_key=${token}`;
      const response = await useSendXhr(url, {
        method: "GET",
        header: {
          "Content-Type": "application/json",
        },
      });

      if (response && response.datasets) {
        const transformedDatasets = response.datasets.map((dataset) => ({
          id: dataset.id,
          sourceDatasetId: dataset.sourceDatasetId,
          name: dataset.name,
          description: dataset.description || "",
          banner: dataset.banner || "",
          size: dataset.size || 0,
          fileCount: dataset.fileCount || 0,
          recordCount: dataset.recordCount || 0,
          owner: `${dataset.ownerFirstName || ""} ${
            dataset.ownerLastName || ""
          }`.trim(),
          organizationName: dataset.organizationName || "",
          updatedAt:
            dataset.updatedAt ||
            dataset.revisedAt ||
            dataset.versionPublishedAt,
          doi: dataset.doi,
          version: dataset.version,
          revision: dataset.revision,
          tags: dataset.tags || [],
          license: dataset.license,
        }));

        return {
          datasets: transformedDatasets,
          totalCount: response.totalCount || 0,
        };
      }

      return { datasets: [], totalCount: 0 };
    } catch (error) {
      console.error("Error searching datasets:", error);
      throw error;
    }
  };

  return {
    // state
    userCollections,
    publicCollections,
    limit,
    offset,
    totalCount,
    targetCollectionDatasets,
    collectionStatus,
    publicDatasetDOIs,
    versionHistory,
    // actions
    clearCollectionsStore,
    createNewCollection,
    getUserCollections,
    getPublicCollections,
    getCollectionDetails,
    getPublishedCollectionDetails,
    deleteCollection,
    editCollection,
    editCollectionDataset,
    publishCollection,
    getPublishedCollectionDOIs,
    // Dataset collections methods
    datasetCollections,
    collections,
    fetchCollections,
    fetchDatasetCollections,
    addCollection,
    removeCollection,
    createCollection,
    getPublicDatasets,
    searchDatasets,
  };
});
