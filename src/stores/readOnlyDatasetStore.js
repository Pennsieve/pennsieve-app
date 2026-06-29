import { ref } from "vue";
import { defineStore } from "pinia";
import { useSendXhr } from "@/mixins/request/request_composable.js";
import * as siteConfig from "@/site-config/site.json";

/**
 * Read-only dataset store.
 *
 * Surfaces datasets a user can navigate but not edit. The first source is
 * public Pennsieve Discover datasets; future sources (e.g. private "views")
 * plug in as additional adapters keyed by `sourceType`, reusing this store's
 * pagination + state. See docs/public-datasets-in-workspace-plan.md.
 */

// Map a raw Discover dataset record onto the common read-only dataset model.
const mapDiscoverDataset = (d) => ({
  sourceType: "discover",
  id: d.id,
  sourceDatasetId: d.sourceDatasetId,
  name: d.name,
  description: d.description || "",
  banner: d.banner || "",
  readme: d.readme || "",
  size: d.size || 0,
  fileCount: d.fileCount || 0,
  recordCount: d.recordCount || 0,
  owner: `${d.ownerFirstName || ""} ${d.ownerLastName || ""}`.trim(),
  organizationName: d.organizationName || "",
  updatedAt: d.updatedAt || d.revisedAt || d.versionPublishedAt,
  doi: d.doi,
  version: d.version,
  revision: d.revision,
  tags: d.tags || [],
  license: d.license,
  contributors: d.contributors || [],
});

// Adapter for Pennsieve Discover (public datasets).
const discoverAdapter = {
  async list({ limit, offset }) {
    const url = `${siteConfig.discoverUrl}/datasets?limit=${limit}&offset=${offset}&datasetType=research&embargo=false`;
    const response = await useSendXhr(url, { method: "GET" });
    return {
      items: (response?.datasets || []).map(mapDiscoverDataset),
      totalCount: response?.totalCount || 0,
    };
  },

  async get(id) {
    const url = `${siteConfig.discoverUrl}/datasets/${id}`;
    const response = await useSendXhr(url, { method: "GET" });
    return mapDiscoverDataset(response);
  },

  // Path-scoped, paginated file browsing for a published version.
  async browseFiles({ id, version, path = "", limit, offset }) {
    const params = new URLSearchParams({ limit, offset });
    if (path) params.set("path", path);
    const url = `${siteConfig.discoverUrl}/datasets/${id}/versions/${version}/files/browse?${params.toString()}`;
    const response = await useSendXhr(url, { method: "GET" });
    return {
      files: response?.files || [],
      totalCount: response?.totalCount || 0,
    };
  },

  // Single-file download: the download-manifest endpoint returns a
  // presigned S3 URL per requested path (used for individual files and as
  // the `src` for image/OME previews; multi-file downloads go through zipit).
  async getFileDownloadUrl({ id, version, path }) {
    const url = `${siteConfig.discoverUrl}/datasets/${id}/versions/${version}/files/download-manifest`;
    const response = await useSendXhr(url, {
      method: "POST",
      body: { paths: [path] },
    });
    return response?.data?.[0]?.url || null;
  },

  // Text/markdown preview content: fetch the file's presigned S3 URL and
  // read it as text (same presigned-URL path as image/OME previews).
  async getFileContent({ id, version, path }) {
    const url = await this.getFileDownloadUrl({ id, version, path });
    if (!url) return "";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.status}`);
    }
    return response.text();
  },
};

const adapters = {
  discover: discoverAdapter,
};

export const useReadOnlyDatasetStore = defineStore("readOnlyDatasetStore", () => {
  const items = ref([]);
  const totalCount = ref(0);
  const limit = ref(20);
  const offset = ref(0);
  const isLoading = ref(false);
  const error = ref(null);

  // Single-dataset detail state (read-only detail view).
  const current = ref(null);
  const isLoadingCurrent = ref(false);
  const currentError = ref(null);

  const fetchDatasets = async (sourceType = "discover") => {
    const adapter = adapters[sourceType];
    if (!adapter) {
      error.value = new Error(`Unknown read-only dataset source: ${sourceType}`);
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      const result = await adapter.list({
        limit: limit.value,
        offset: offset.value,
      });
      items.value = result.items;
      totalCount.value = result.totalCount;
    } catch (e) {
      console.error("Error loading read-only datasets:", e);
      error.value = e;
      items.value = [];
      totalCount.value = 0;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchDataset = async (id, sourceType = "discover") => {
    const adapter = adapters[sourceType];
    if (!adapter?.get) {
      currentError.value = new Error(`Unknown read-only dataset source: ${sourceType}`);
      return;
    }

    isLoadingCurrent.value = true;
    currentError.value = null;
    try {
      current.value = await adapter.get(id);
    } catch (e) {
      console.error("Error loading read-only dataset:", e);
      currentError.value = e;
      current.value = null;
    } finally {
      isLoadingCurrent.value = false;
    }
  };

  // Stateless helper — the detail/files view owns its own pagination + path state.
  const browseFiles = async ({ id, version, path, limit: pageLimit, offset: pageOffset, sourceType = "discover" }) => {
    const adapter = adapters[sourceType];
    if (!adapter?.browseFiles) {
      return { files: [], totalCount: 0 };
    }
    return adapter.browseFiles({ id, version, path, limit: pageLimit, offset: pageOffset });
  };

  // Returns a presigned URL for a single file, or null.
  const getFileDownloadUrl = async ({ id, version, path, sourceType = "discover" }) => {
    const adapter = adapters[sourceType];
    if (!adapter?.getFileDownloadUrl) return null;
    return adapter.getFileDownloadUrl({ id, version, path });
  };

  // Returns text content for a previewable file (text/markdown).
  const getFileContent = async ({ id, version, path, sourceType = "discover" }) => {
    const adapter = adapters[sourceType];
    if (!adapter?.getFileContent) return "";
    return adapter.getFileContent({ id, version, path });
  };

  // page is 1-based, matching el-pagination
  const setPage = (page) => {
    offset.value = Math.max(0, (page - 1) * limit.value);
  };

  const setPageSize = (size) => {
    limit.value = size;
    offset.value = 0;
  };

  return {
    items,
    totalCount,
    limit,
    offset,
    isLoading,
    error,
    current,
    isLoadingCurrent,
    currentError,
    fetchDatasets,
    fetchDataset,
    browseFiles,
    getFileDownloadUrl,
    getFileContent,
    setPage,
    setPageSize,
  };
});
