import { describe, it, expect } from "vitest";
import { targetWritesToDataset, prefixParamName, targetParamFields, buildDataTargets, targetDatasetId, datasetName, searchDatasets, isPathPrefixParam, targetParamLabel, NOTIFY_OPTIONS, defaultsToRunName } from "./dataTargets";

describe("targetWritesToDataset / prefixParamName", () => {
  it("built-ins write no dataset and take pathPrefix", () => {
    expect(targetWritesToDataset("download")).toBe(false);
    expect(targetWritesToDataset("persistent-layer")).toBe(false);
    expect(targetWritesToDataset("Pennsieve Dataset")).toBe(true);
    expect(targetWritesToDataset(null)).toBe(false);
    expect(prefixParamName("download")).toBe("pathPrefix");
    expect(prefixParamName("Pennsieve Dataset")).toBe("PATH_PREFIX");
  });
});

describe("targetParamFields", () => {
  const defs = [
    { name: "TARGET_FOLDER", type: "string", defaultValue: "" },
    { name: "PATH_PREFIX", type: "string", description: "Only below this path", defaultValue: "" },
    { name: "OVERWRITE_FILES", type: "boolean", defaultValue: "false" },
  ];
  it("prefers the rerun source, then the definition, then the registry", () => {
    const fields = targetParamFields(defs, {
      sourceParams: { TARGET_FOLDER: "from-run" },
      definitionDefaults: { TARGET_FOLDER: "from-def", PATH_PREFIX: "qc" },
    });
    expect(fields.map((f) => f.value)).toEqual(["from-run", "qc", "false"]);
    expect(fields[1].description).toBe("Only below this path");
  });
  it("marks params without a registry default required", () => {
    const fields = targetParamFields([{ name: "layerName" }, { name: "notify", defaultValue: "auto" }]);
    expect(fields.map((f) => [f.required, f.value])).toEqual([[true, ""], [false, "auto"]]);
  });
});

describe("buildDataTargets", () => {
  const dag = [
    { id: "src", type: "data-source" },
    { id: "a", type: "data-target", targetType: "Pennsieve Dataset" },
    { id: "b", type: "data-target", targetType: "Pennsieve Dataset" },
    { id: "dl", type: "data-target", targetType: "download" },
  ];
  it("sends a target's own dataset only when it differs from the run's", () => {
    const out = buildDataTargets(dag, {
      a: { datasetId: "N:dataset:other", params: [{ name: "PATH_PREFIX", value: "qc" }, { name: "TARGET_FOLDER", value: "" }] },
      b: { datasetId: "N:dataset:run", params: [{ name: "PATH_PREFIX", value: "data" }] },
      dl: { datasetId: "N:dataset:other", params: [{ name: "pathPrefix", value: "reports" }, { name: "notify", value: "none" }] },
    }, "N:dataset:run");
    expect(out).toEqual({
      a: { datasetId: "N:dataset:other", params: { PATH_PREFIX: "qc" } },
      b: { params: { PATH_PREFIX: "data" } },
      dl: { params: { pathPrefix: "reports", notify: "none" } }, // a built-in never names a dataset
    });
  });
  it("sends a dataset without params, and nothing for an empty target", () => {
    expect(buildDataTargets(dag, { a: { datasetId: "N:dataset:x", params: [] }, b: { params: [] } }, "N:dataset:run"))
      .toEqual({ a: { datasetId: "N:dataset:x" } });
    expect(buildDataTargets(dag, {}, "")).toEqual({});
  });
});

describe("targetDatasetId / datasetName", () => {
  const datasets = [{ content: { id: "N:dataset:1", name: "One" } }];
  it("falls back to the run's dataset and to the id", () => {
    expect(targetDatasetId({ datasetId: "N:dataset:2" }, "N:dataset:1")).toBe("N:dataset:2");
    expect(targetDatasetId({ params: {} }, "N:dataset:1")).toBe("N:dataset:1");
    expect(datasetName("N:dataset:1", datasets)).toBe("One");
    expect(datasetName("N:dataset:9", datasets)).toBe("N:dataset:9");
  });
});

describe("searchDatasets", () => {
  it("asks the paginated datasets endpoint with the query and token", async () => {
    const calls = [];
    const out = await searchDatasets("https://api", "mef", {
      getToken: async () => "tok",
      sendXhr: async (url) => { calls.push(url); return { datasets: [{ content: { id: "N:dataset:1" } }] }; },
      toQueryParams: (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join("&"),
    });
    expect(out).toHaveLength(1);
    expect(calls[0]).toContain("https://api/datasets/paginated?");
    expect(calls[0]).toContain("query=mef");
    expect(calls[0]).toContain("api_key=tok");
  });
});

describe("the notebook launcher's target params", () => {
  it("leaves out the path prefix, names the download after the run, labels its params", () => {
    expect(isPathPrefixParam("pathPrefix")).toBe(true);
    expect(isPathPrefixParam("PATH_PREFIX")).toBe(true);
    expect(isPathPrefixParam("name")).toBe(false);
    expect(defaultsToRunName("download", "name")).toBe(true);
    expect(defaultsToRunName("pennsieve", "name")).toBe(false);
    expect(targetParamLabel("name")).toBe("Archive name");
    expect(targetParamLabel("layerName")).toBe("layerName");
    expect(NOTIFY_OPTIONS.map((o) => o.value)).toEqual(["auto", "email", "none"]);
  });
});
