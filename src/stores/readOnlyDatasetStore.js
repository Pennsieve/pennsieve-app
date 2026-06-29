import { ref } from "vue";
import { defineStore } from "pinia";
import { useSendXhr } from "@/mixins/request/request_composable.js";
import { useDuckDBStore } from "@/stores/duckdbStore.js";
import * as siteConfig from "@/site-config/site.json";

// "cde_classification" -> "Cde Classification"
const humanize = (name) =>
  String(name)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const escapeSql = (s) => String(s).replace(/'/g, "''");
const safeTable = (s) => String(s).replace(/[^a-zA-Z0-9_]/g, "_");

// A DuckDB row of { id, data:<json string> } -> { id, value:<object> }.
const parseRecordRow = (row) => {
  let value = {};
  try {
    value = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {};
  } catch (e) {
    value = {};
  }
  return { id: row.id, value };
};

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
  versionPublishedAt: d.versionPublishedAt,
  doi: d.doi,
  version: d.version,
  revision: d.revision,
  tags: d.tags || [],
  license: d.license,
  contributors: d.contributors || [],
  externalPublications: d.externalPublications || [],
});

// Adapter for Pennsieve Discover (public datasets).
const discoverAdapter = {
  async list({ limit, offset, query }) {
    const url = query
      ? `${siteConfig.discoverUrl}/search/datasets?limit=${limit}&offset=${offset}&query=${encodeURIComponent(query)}`
      : `${siteConfig.discoverUrl}/datasets?limit=${limit}&offset=${offset}&datasetType=research&embargo=false`;
    const response = await useSendXhr(url, { method: "GET" });
    return {
      items: (response?.datasets || []).map(mapDiscoverDataset),
      totalCount: response?.totalCount || 0,
    };
  },

  async get(id, version) {
    const url = version
      ? `${siteConfig.discoverUrl}/datasets/${id}/versions/${version}`
      : `${siteConfig.discoverUrl}/datasets/${id}`;
    const response = await useSendXhr(url, { method: "GET" });
    return mapDiscoverDataset(response);
  },

  // All published versions of a dataset (newest first).
  async getVersions(id) {
    const url = `${siteConfig.discoverUrl}/datasets/${id}/versions`;
    const response = await useSendXhr(url, { method: "GET" });
    return (Array.isArray(response) ? response : [])
      .map(mapDiscoverDataset)
      .sort((a, b) => b.version - a.version);
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

  // ---- Metadata (models/records stored as S3 files; no metadata service) ----

  // Latest model version directory (max numeric name under .../versions).
  async _latestModelVersion({ id, version, model }) {
    const { files } = await this.browseFiles({
      id,
      version,
      path: `metadata/models/${model}/versions`,
      limit: 1000,
      offset: 0,
    });
    const nums = (files || [])
      .filter((f) => f.type === "Directory")
      .map((f) => parseInt(f.name, 10))
      .filter((n) => !Number.isNaN(n));
    return nums.length ? Math.max(...nums) : 1;
  },

  // One model: its latest schema.json + derived display fields.
  async getModel({ id, version, model }) {
    const modelVersion = await this._latestModelVersion({ id, version, model });
    const url = await this.getFileDownloadUrl({
      id,
      version,
      path: `metadata/models/${model}/versions/${modelVersion}/schema.json`,
    });
    let schema = { properties: {} };
    if (url) {
      const response = await fetch(url);
      if (response.ok) schema = await response.json();
    }
    const properties = schema.properties || {};
    const titleProperty =
      Object.keys(properties).find((k) => properties[k]?.["x-pennsieve-key"]) ||
      (schema.required && schema.required[0]) ||
      Object.keys(properties)[0] ||
      "id";
    return {
      name: model,
      displayName: humanize(model),
      modelVersion,
      schema,
      properties,
      propertyCount: Object.keys(properties).length,
      titleProperty,
    };
  },

  // All models for a dataset version (directory names under metadata/models).
  async listModels({ id, version }) {
    const { files } = await this.browseFiles({
      id,
      version,
      path: "metadata/models",
      limit: 1000,
      offset: 0,
    });
    const names = (files || [])
      .filter((f) => f.type === "Directory")
      .map((f) => f.name);
    return Promise.all(names.map((model) => this.getModel({ id, version, model })));
  },

  // Presigned URL for a model's records.jsonl (fed to DuckDB).
  async getRecordsUrl({ id, version, model, modelVersion }) {
    return this.getFileDownloadUrl({
      id,
      version,
      path: `metadata/models/${model}/versions/${modelVersion}/records.jsonl`,
    });
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
  const query = ref("");
  const isLoading = ref(false);
  const error = ref(null);

  // Single-dataset detail state (read-only detail view).
  const current = ref(null);
  const isLoadingCurrent = ref(false);
  const currentError = ref(null);
  const versions = ref([]);

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
        query: query.value,
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

  const fetchDataset = async (id, version = null, sourceType = "discover") => {
    const adapter = adapters[sourceType];
    if (!adapter?.get) {
      currentError.value = new Error(`Unknown read-only dataset source: ${sourceType}`);
      return;
    }

    isLoadingCurrent.value = true;
    currentError.value = null;
    try {
      current.value = await adapter.get(id, version);
    } catch (e) {
      console.error("Error loading read-only dataset:", e);
      currentError.value = e;
      current.value = null;
    } finally {
      isLoadingCurrent.value = false;
    }
  };

  const fetchVersions = async (id, sourceType = "discover") => {
    const adapter = adapters[sourceType];
    if (!adapter?.getVersions) {
      versions.value = [];
      return;
    }
    try {
      versions.value = await adapter.getVersions(id);
    } catch (e) {
      console.warn("Could not load dataset versions:", e);
      versions.value = [];
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

  // ---- Metadata ----

  // Per-dataset caches (not reactive — just memoization for the session).
  const _modelsCache = new Map();
  const _indexedDatasets = new Set();

  // Load a model's records.jsonl into DuckDB, falling back to a lenient
  // line-by-line parse if the file is malformed JSON (some publish pipelines
  // double-escape quotes, producing invalid JSONL).
  const _loadRecords = async (duck, url, table, fileId) => {
    try {
      await _loadRecords(duck, url, table, fileId);
    } catch (e) {
      console.warn("Native JSONL load failed; using lenient parser:", e);
      await duck.loadJsonlLenient(url, table, fileId);
    }
  };

  const listModels = async (id, version, sourceType = "discover") => {
    const key = `${sourceType}:${id}:${version}`;
    if (_modelsCache.has(key)) return _modelsCache.get(key);
    const adapter = adapters[sourceType];
    if (!adapter?.listModels) return [];
    const models = await adapter.listModels({ id, version });
    _modelsCache.set(key, models);
    return models;
  };

  // Build (once per dataset) a flat index of every record across all models:
  // (id, model, model_version, label). Lets relationship target ids resolve to
  // a label + owning model so they can be linked. Lazy + cached.
  const _buildMetadataIndex = async (id, version, sourceType = "discover") => {
    const key = `${sourceType}:${id}:${version}`;
    const idxTable = `idx_${safeTable(`${id}_${version}`)}`;
    if (_indexedDatasets.has(key)) return idxTable;

    const adapter = adapters[sourceType];
    const models = await listModels(id, version, sourceType);
    const duck = useDuckDBStore();
    const { connectionId } = await duck.createConnection();
    try {
      await duck.executeQuery(
        `CREATE TABLE IF NOT EXISTS ${idxTable} (id VARCHAR, model VARCHAR, model_version INTEGER, label VARCHAR)`,
        connectionId
      );
      await duck.executeQuery(`DELETE FROM ${idxTable}`, connectionId);

      for (const m of models) {
        const url = await adapter.getRecordsUrl({
          id,
          version,
          model: m.name,
          modelVersion: m.modelVersion,
        });
        if (!url) continue;
        const recTable = `rec_${safeTable(m.name)}_${m.modelVersion}`;
        const fileId = `${id}:${version}:${m.name}:${m.modelVersion}:records`;
        await _loadRecords(duck, url, recTable, fileId);
        // Extract the title via JSON (-> ) so a missing key yields NULL
        // instead of a struct binder error.
        await duck.executeQuery(
          `INSERT INTO ${idxTable}
             SELECT CAST(id AS VARCHAR), '${escapeSql(m.name)}', ${m.modelVersion},
                    (to_json(data) ->> '${escapeSql(m.titleProperty)}')
             FROM ${recTable}`,
          connectionId
        );
      }
      _indexedDatasets.add(key);
      return idxTable;
    } finally {
      await duck.closeConnection(connectionId);
    }
  };

  // Resolve a set of record ids to { [id]: { model, modelVersion, label } }.
  const resolveRecords = async (id, version, recordIds, sourceType = "discover") => {
    const ids = [...new Set((recordIds || []).filter(Boolean))];
    if (!ids.length) return {};
    const idxTable = await _buildMetadataIndex(id, version, sourceType);
    const duck = useDuckDBStore();
    const { connectionId } = await duck.createConnection();
    try {
      const inList = ids.map((x) => `'${escapeSql(x)}'`).join(",");
      const rows = await duck.executeQuery(
        `SELECT id, model, model_version, label FROM ${idxTable} WHERE id IN (${inList})`,
        connectionId
      );
      const map = {};
      for (const r of rows) {
        map[r.id] = {
          model: r.model,
          modelVersion: Number(r.model_version),
          label: r.label,
        };
      }
      return map;
    } finally {
      await duck.closeConnection(connectionId);
    }
  };

  const getModel = async (id, version, model, sourceType = "discover") => {
    const adapter = adapters[sourceType];
    if (!adapter?.getModel) return null;
    return adapter.getModel({ id, version, model });
  };

  // Query a model's records.jsonl through DuckDB-WASM (offset-paginated).
  // Returns { records: [{ id, value }], totalCount }.
  const queryRecords = async ({
    id,
    version,
    model,
    modelVersion,
    limit = 25,
    offset = 0,
    search = "",
    orderBy = "",
    orderDir = "asc",
    sourceType = "discover",
  }) => {
    const adapter = adapters[sourceType];
    if (!adapter?.getRecordsUrl) return { records: [], totalCount: 0 };

    const url = await adapter.getRecordsUrl({ id, version, model, modelVersion });
    if (!url) return { records: [], totalCount: 0 };

    const duck = useDuckDBStore();
    const table = `rec_${safeTable(model)}_${modelVersion}`;
    const fileId = `${id}:${version}:${model}:${modelVersion}:records`;

    // loadFile caches by fileId, so pagination reuses the loaded table.
    await _loadRecords(duck, url, table, fileId);

    // Search across all values; order by a single property (via JSON so a
    // missing key is NULL rather than a struct binder error).
    const where = search
      ? `WHERE CAST(to_json(data) AS VARCHAR) ILIKE '%${escapeSql(search)}%'`
      : "";
    const dir = /desc/i.test(orderDir) ? "DESC" : "ASC";
    const order = orderBy
      ? `ORDER BY (to_json(data) ->> '${escapeSql(orderBy)}') ${dir} NULLS LAST`
      : "";

    const { connectionId } = await duck.createConnection();
    try {
      const totalRows = await duck.executeQuery(
        `SELECT COUNT(*)::INT AS c FROM ${table} ${where}`,
        connectionId
      );
      const rows = await duck.executeQuery(
        `SELECT id, to_json(data) AS data FROM ${table} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`,
        connectionId
      );
      return { records: rows.map(parseRecordRow), totalCount: Number(totalRows[0]?.c || 0) };
    } finally {
      await duck.closeConnection(connectionId);
    }
  };

  // Single record by id (reuses the cached records table).
  const getRecord = async ({ id, version, model, modelVersion, recordId, sourceType = "discover" }) => {
    const adapter = adapters[sourceType];
    if (!adapter?.getRecordsUrl) return null;
    const url = await adapter.getRecordsUrl({ id, version, model, modelVersion });
    if (!url) return null;

    const duck = useDuckDBStore();
    const table = `rec_${safeTable(model)}_${modelVersion}`;
    const fileId = `${id}:${version}:${model}:${modelVersion}:records`;
    await _loadRecords(duck, url, table, fileId);

    const { connectionId } = await duck.createConnection();
    try {
      const rows = await duck.executeQuery(
        `SELECT id, to_json(data) AS data FROM ${table} WHERE id = '${escapeSql(recordId)}' LIMIT 1`,
        connectionId
      );
      return rows.length ? parseRecordRow(rows[0]) : null;
    } finally {
      await duck.closeConnection(connectionId);
    }
  };

  // Relationships for a record (from metadata/relationships.csv).
  // Returns { outbound: [{target_record_id, relationship_type}], inbound: [...] }.
  const getRecordRelationships = async ({ id, version, recordId, sourceType = "discover" }) => {
    const empty = { outbound: [], inbound: [] };
    const adapter = adapters[sourceType];
    try {
      const url = await adapter.getFileDownloadUrl({ id, version, path: "metadata/relationships.csv" });
      if (!url) return empty;
      const duck = useDuckDBStore();
      const table = `rels_${safeTable(`${id}_${version}`)}`;
      await duck.loadFile(url, "csv", table, {}, null, `${id}:${version}:relationships`);
      const { connectionId } = await duck.createConnection();
      try {
        const rid = escapeSql(recordId);
        const outbound = await duck.executeQuery(
          `SELECT target_record_id, relationship_type FROM ${table} WHERE source_record_id = '${rid}'`,
          connectionId
        );
        const inbound = await duck.executeQuery(
          `SELECT source_record_id, relationship_type FROM ${table} WHERE target_record_id = '${rid}'`,
          connectionId
        );
        return { outbound, inbound };
      } finally {
        await duck.closeConnection(connectionId);
      }
    } catch (e) {
      console.warn("No relationships available:", e);
      return empty;
    }
  };

  // Files attached to a record (from metadata/files.csv).
  const getRecordFiles = async ({ id, version, recordId, sourceType = "discover" }) => {
    const adapter = adapters[sourceType];
    try {
      const url = await adapter.getFileDownloadUrl({ id, version, path: "metadata/files.csv" });
      if (!url) return [];
      const duck = useDuckDBStore();
      const table = `recfiles_${safeTable(`${id}_${version}`)}`;
      await duck.loadFile(url, "csv", table, {}, null, `${id}:${version}:recfiles`);
      const { connectionId } = await duck.createConnection();
      try {
        return await duck.executeQuery(
          `SELECT package_id, path FROM ${table} WHERE record_id = '${escapeSql(recordId)}'`,
          connectionId
        );
      } finally {
        await duck.closeConnection(connectionId);
      }
    } catch (e) {
      console.warn("No record files available:", e);
      return [];
    }
  };

  // page is 1-based, matching el-pagination
  const setPage = (page) => {
    offset.value = Math.max(0, (page - 1) * limit.value);
  };

  const setPageSize = (size) => {
    limit.value = size;
    offset.value = 0;
  };

  const setQuery = (q) => {
    query.value = q || "";
    offset.value = 0;
  };

  return {
    items,
    totalCount,
    limit,
    offset,
    query,
    isLoading,
    error,
    current,
    isLoadingCurrent,
    currentError,
    versions,
    fetchDatasets,
    fetchDataset,
    fetchVersions,
    browseFiles,
    getFileDownloadUrl,
    getFileContent,
    listModels,
    getModel,
    queryRecords,
    getRecord,
    getRecordRelationships,
    getRecordFiles,
    resolveRecords,
    setPage,
    setPageSize,
    setQuery,
  };
});
