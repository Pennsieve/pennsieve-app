import { describe, it, expect } from "vitest";
import { appSampleEntry, ownSampleEntry, sameRepo, sortEntries, workflowsUsingApp } from "./appSamples";

const URL = "https://github.com/pennsieve-apps/st-niches";
const wf = (uuid, name, urls) => ({
  uuid,
  name,
  dag: [
    { id: "in", type: "data-source" },
    ...urls.map((u, i) => ({ id: `s${i}`, type: "processor", sourceUrl: u, dependsOn: ["in"] })),
  ],
});

describe("sameRepo", () => {
  it("matches a repository however its URL is written", () => {
    expect(sameRepo(URL, `${URL}.git`)).toBe(true);
    expect(sameRepo(URL, `${URL}/`)).toBe(true);
    expect(sameRepo(URL, URL.replace("pennsieve-apps", "Pennsieve-Apps"))).toBe(true);
    expect(sameRepo(URL, "https://github.com/pennsieve-apps/st-ccc")).toBe(false);
    expect(sameRepo("", "")).toBe(false);
  });
});

describe("workflowsUsingApp", () => {
  it("keeps the workflows with a step running the app, once each", () => {
    const a = wf("a", "A", ["https://github.com/pennsieve-apps/st-prep", URL]);
    const b = wf("b", "B", ["https://github.com/pennsieve-apps/st-ccc"]);
    expect(workflowsUsingApp([a, b, a], URL).map((w) => w.uuid)).toEqual(["a"]);
  });
});

describe("entries", () => {
  it("lists a workflow with a sample output, by name", () => {
    expect(appSampleEntry(wf("a", "Spatial", [URL]), { version: 3 })).toEqual({
      workflow: { uuid: "a", name: "Spatial" },
      example: { version: 3 },
    });
    expect(appSampleEntry(wf("a", "Spatial", [URL]), null)).toBe(null);
    const e = (name) => ({ workflow: { name } });
    expect(sortEntries([e("Z"), e("A")]).map((x) => x.workflow.name)).toEqual(["A", "Z"]);
  });
});

describe("the app's own", () => {
  it("is an entry without a workflow, sorted first", () => {
    expect(ownSampleEntry(null)).toBe(null);
    const own = ownSampleEntry({ app: { tag: "v1" } });
    expect(own).toEqual({ own: true, workflow: null, example: { app: { tag: "v1" } } });
    const e = (name) => ({ workflow: { name } });
    expect(sortEntries([e("B"), own, e("A")]).map((x) => (x.own ? "own" : x.workflow.name))).toEqual(["own", "A", "B"]);
  });
});
