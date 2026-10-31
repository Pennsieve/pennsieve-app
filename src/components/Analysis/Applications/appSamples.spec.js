import { describe, it, expect } from "vitest";
import {
  appSampleEntry,
  firstPage,
  pageRanges,
  pagesText,
  sameRepo,
  sortEntries,
  stepSummary,
  workflowsUsingApp,
} from "./appSamples";

const URL = "https://github.com/pennsieve-apps/st-niches";
const wf = (uuid, name, urls) => ({
  uuid,
  name,
  dag: [
    { id: "in", type: "data-source" },
    ...urls.map((u, i) => ({ id: `s${i}`, type: "processor", sourceUrl: u, dependsOn: ["in"] })),
  ],
});
const niches = { step: "niches", app: "st-niches", sourceUrl: URL, version: "v0.1.0", figures: 3, outputs: 1, notStored: 0, pages: [4, 5, 8, 9, 10] };

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
    const a = wf("a", "A", [URL]);
    const b = wf("b", "B", ["https://github.com/pennsieve-apps/st-ccc"]);
    expect(workflowsUsingApp([a, b, a], URL).map((w) => w.uuid)).toEqual(["a"]);
  });
});

describe("page ranges", () => {
  it("joins runs of pages", () => {
    expect(pageRanges([10, 4, 5, 8, 9, 4])).toBe("4–5, 8–10");
    expect(pagesText([4, 5, 8, 9, 10])).toBe("pages 4–5, 8–10");
    expect(pagesText([2])).toBe("page 2");
    expect(pagesText([])).toBe("");
    expect(firstPage(niches)).toBe(4);
    expect(firstPage({ pages: [] })).toBe(null);
  });
});

describe("stepSummary", () => {
  it("says what the PDF shows of the step, and where", () => {
    expect(stepSummary(niches)).toBe("3 figures · 1 output · pages 4–5, 8–10");
    expect(stepSummary({ figures: 1, outputs: 0, pages: [2] })).toBe("1 figure · page 2");
  });
  it("says why it shows nothing", () => {
    expect(stepSummary({ figures: 0, outputs: 0, notStored: 1, pages: [] })).toMatch(/didn't save the step's outputs/);
    expect(stepSummary({ figures: 0, outputs: 0, notStored: 0, pages: [] })).toMatch(/shows nothing/);
  });
});

describe("appSampleEntry", () => {
  const w = wf("a", "Spatial Profiling", [URL]);
  it("keeps the app's steps from the PDF's index", () => {
    const e = appSampleEntry(w, { version: 3, steps: [niches, { ...niches, step: "ccc", sourceUrl: "https://x/st-ccc" }] }, URL);
    expect(e.indexed).toBe(true);
    expect(e.steps.map((s) => s.step)).toEqual(["niches"]);
    expect(e.workflow).toEqual({ uuid: "a", name: "Spatial Profiling" });
  });
  it("leaves out a sample whose index has no step running the app", () => {
    expect(appSampleEntry(w, { steps: [{ ...niches, sourceUrl: "https://x/st-ccc" }] }, URL)).toBe(null);
    expect(appSampleEntry(w, null, URL)).toBe(null);
  });
  it("shows a sample from before the index without pages", () => {
    const e = appSampleEntry(w, { version: 3 }, URL);
    expect(e.indexed).toBe(false);
    expect(e.steps).toEqual([]);
  });
});

describe("sortEntries", () => {
  it("puts samples showing the app first, then by name", () => {
    const shown = { workflow: { name: "Z" }, indexed: true, steps: [niches] };
    const old = { workflow: { name: "A" }, indexed: false, steps: [] };
    const nothing = { workflow: { name: "B" }, indexed: true, steps: [{ ...niches, figures: 0, outputs: 0, pages: [] }] };
    expect(sortEntries([nothing, old, shown]).map((e) => e.workflow.name)).toEqual(["Z", "A", "B"]);
  });
});
