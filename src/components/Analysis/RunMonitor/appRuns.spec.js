import { describe, it, expect } from "vitest";
import { appOf, appRunLabel, appRunPayload, appStepId, setupKey } from "./appRuns";

const URL = "https://github.com/pennsieve-apps/st-niches";

describe("appOf", () => {
  it("is the app a config or run names, or null", () => {
    expect(appOf({ app: { sourceUrl: URL, tag: "v1", name: "x" } })).toEqual({ sourceUrl: URL, tag: "v1" });
    expect(appOf({ app: { sourceUrl: URL, tag: "v1", variant: "gpu" } })).toEqual({ sourceUrl: URL, tag: "v1", variant: "gpu" });
    expect(appOf({ app: { sourceUrl: URL } })).toBe(null);
    expect(appOf({ workflowId: "wf" })).toBe(null);
  });
});

describe("appStepId", () => {
  it("is the one step of the app run's workflow", () => {
    const definition = { dag: [{ id: "input-spatial", type: "data-source" }, { id: "st-niches", type: "processor" }, { id: "results", type: "data-target" }] };
    expect(appStepId(definition)).toBe("st-niches");
    expect(appStepId(null)).toBe("");
  });
});

describe("appRunPayload", () => {
  const base = {
    workflowInstanceConfiguration: {
      workflowId: "",
      computeNodeId: "node-1",
      processorConfigs: [{ nodeId: "st-niches", version: "v0.2.0", variant: "gpu", cpu: 2048 }],
    },
    dataSources: { "input-spatial": { packageIds: ["N:package:1"] } },
    name: "try",
  };
  it("names the app instead of a workflow, with the version and variant chosen for its step", () => {
    const p = appRunPayload(base, { sourceUrl: URL, tag: "v0.1.0" }, "st-niches");
    expect(p.app).toEqual({ sourceUrl: URL, tag: "v0.2.0", variant: "gpu" });
    expect(p.workflowInstanceConfiguration).toEqual({ computeNodeId: "node-1", processorConfigs: [{ nodeId: "st-niches", cpu: 2048 }] });
    expect(p.dataSources).toEqual(base.dataSources);
    expect(p.name).toBe("try");
  });
  it("keeps the app's version and variant when the step has none", () => {
    const p = appRunPayload({ workflowInstanceConfiguration: { workflowId: "", computeNodeId: "n" } }, { sourceUrl: URL, tag: "v1", variant: "cpu" }, "st-niches");
    expect(p.app).toEqual({ sourceUrl: URL, tag: "v1", variant: "cpu" });
    expect(p.workflowInstanceConfiguration).toEqual({ computeNodeId: "n" });
  });
});

describe("labels and keys", () => {
  it("names an app run's app", () => {
    expect(appRunLabel({ name: "st-niches", tag: "v0.1.0" })).toBe("st-niches v0.1.0");
    expect(appRunLabel({ sourceUrl: `${URL}.git`, tag: "v2", variant: "gpu" })).toBe("st-niches v2 · gpu");
    expect(appRunLabel(null)).toBe("");
  });
  it("remembers an app run's setup per app", () => {
    expect(setupKey({ app: { sourceUrl: URL } })).toBe(`app:${URL}`);
    expect(setupKey({ workflowId: "wf-1" })).toBe("wf-1");
  });
});

import { tryableVersion } from "./appRuns";
describe("tryableVersion", () => {
  it("is the newest deployed version", () => {
    const versions = [
      { version: "v1", status: "DEPLOYED", createdAt: "2026-01-01" },
      { version: "v3", status: "deploying", createdAt: "2026-03-01" },
      { version: "v2", status: "deployed", createdAt: "2026-02-01" },
    ];
    expect(tryableVersion(versions).version).toBe("v2");
    expect(tryableVersion([])).toBe(null);
  });
  it("isn't offered for an interactive app", () => {
    expect(tryableVersion([{ version: "v1", status: "deployed", manifest: { runtime: { interactive: true } } }])).toBe(null);
    expect(tryableVersion([{ version: "v1", status: "deployed", manifest: { runtime: { sessionType: "jupyter" } } }])).toBe(null);
  });
});
