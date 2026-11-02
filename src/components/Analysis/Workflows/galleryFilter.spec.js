import { describe, it, expect } from "vitest";
import { applyFilters, fieldOptions, libraryWorkflows, workflowFields, matchesSearch, outputOptions, sortWorkflows, workflowsView } from "./galleryFilter";

const spikes = {
  name: "EEG spikes",
  description: "Finds interictal spikes",
  official: true,
  createdAt: "2026-01-01",
  metrics: { totalRuns: 3, lastRunAt: "2026-10-20" },
  dag: [
    { id: "s", type: "data-source" },
    { id: "a", type: "processor", sourceUrl: "https://github.com/org/spike-detect" },
    { id: "t", type: "data-target", targetType: "pennsieve" },
  ],
};
const zipper = {
  name: "Zip it",
  createdAt: "2026-05-01",
  metrics: { totalRuns: 9, lastRunAt: "2026-09-01" },
  dag: [
    { id: "a", type: "processor", sourceUrl: "https://github.com/org/zipper" },
    { id: "t", type: "data-target", targetType: "download" },
  ],
};
const unused = { name: "Alpha", createdAt: "2026-08-01", dag: [] };
const targetTypes = [
  { targetType: "pennsieve", label: "Pennsieve Dataset" },
  { targetType: "download", label: "Download" },
];

describe("matchesSearch", () => {
  it("matches names, descriptions, apps and inputs and outputs", () => {
    expect(matchesSearch(spikes, "interictal")).toBe(true);
    expect(matchesSearch(spikes, "spike-detect")).toBe(true);
    expect(matchesSearch(zipper, "download", { targetTypes })).toBe(true);
    expect(matchesSearch(zipper, "zip download", { targetTypes })).toBe(true);
    expect(matchesSearch(zipper, "zip pennsieve", { targetTypes })).toBe(false);
  });
});

describe("applyFilters", () => {
  const all = [spikes, zipper, unused];
  it("filters by input, output and Pennsieve's", () => {
    expect(applyFilters(all, { input: "dataset" })).toEqual([spikes]);
    expect(applyFilters(all, { input: "none" }).map((w) => w.name)).toEqual(["Zip it", "Alpha"]);
    expect(applyFilters(all, { output: "download" })).toEqual([zipper]);
    expect(applyFilters(all, { officialOnly: true })).toEqual([spikes]);
  });

  it("leaves notebooks out of the Library (they start on the Notebooks tab)", () => {
    const jupyter = { name: "Pennsieve - Python Notebook - 3.12", official: true, notebook: { kernel: "python", savesTo: "dataset", worksWithoutDataset: false } };
    expect(libraryWorkflows([spikes, jupyter])).toEqual([spikes]);
  });

  it("lists notebooks too when asked (Include notebooks)", () => {
    const jupyter = { name: "Pennsieve - Python Notebook - 3.12 (GPU)", notebook: { kernel: "python", variant: "gpu", gpu: true } };
    expect(libraryWorkflows([spikes, jupyter], true)).toEqual([spikes, jupyter]);
  });

  it("offers the outputs the list has", () => {
    expect(outputOptions(all, targetTypes)).toEqual([
      { value: "download", label: "Download" },
      { value: "pennsieve", label: "Pennsieve Dataset" },
    ]);
  });
});

describe("research fields", () => {
  const app = (url, tags) => ({ sourceUrl: url, versions: [{ version: "v1", createdAt: "2026-01-01", manifest: { tags } }] });
  const applications = [
    app("https://github.com/org/spike-detect", ["eeg", "epilepsy"]),
    app("https://github.com/org/fcs-qc", ["cytometry", "immunology"]),
    app("https://github.com/org/tumour-map", ["imaging", "oncology", "immune"]),
  ];
  const step = (url) => ({ id: url, type: "processor", sourceUrl: url });
  const cyto = { name: "Cyto", dag: [step("https://github.com/org/fcs-qc/"), step("https://github.com/org/tumour-map")] };
  const all = [spikes, zipper, cyto];

  it("are the union of its steps' apps' fields", () => {
    expect(workflowFields(spikes, applications).map((f) => f.key)).toEqual(["neuroscience"]);
    expect(workflowFields(cyto, applications).map((f) => f.key)).toEqual(["immunology", "oncology"]);
    // An app not loaded, or without fields, adds none.
    expect(workflowFields(zipper, applications)).toEqual([]);
  });

  it("offers the fields the list has, most common first", () => {
    const more = { name: "Spikes again", dag: [step("https://github.com/org/spike-detect")] };
    expect(fieldOptions([...all, more], applications).map((o) => [o.field.key, o.count])).toEqual([
      ["neuroscience", 2],
      ["immunology", 1],
      ["oncology", 1],
    ]);
  });

  it("filters by field, with the other filters", () => {
    expect(applyFilters(all, { field: "immunology", applications })).toEqual([cyto]);
    expect(applyFilters(all, { field: "neuroscience", input: "dataset", applications })).toEqual([spikes]);
    expect(applyFilters(all, { field: "neuroscience", input: "none", applications })).toEqual([]);
    expect(applyFilters(all, { field: "any", applications })).toEqual(all);
  });
});

describe("sortWorkflows", () => {
  const all = [unused, zipper, spikes];
  it("sorts by use, runs, age or name", () => {
    expect(sortWorkflows(all, "recent").map((w) => w.name)).toEqual(["EEG spikes", "Zip it", "Alpha"]);
    expect(sortWorkflows(all, "runs").map((w) => w.name)).toEqual(["Zip it", "EEG spikes", "Alpha"]);
    expect(sortWorkflows(all, "newest").map((w) => w.name)).toEqual(["Alpha", "Zip it", "EEG spikes"]);
    expect(sortWorkflows(all, "name").map((w) => w.name)).toEqual(["Alpha", "EEG spikes", "Zip it"]);
  });
});

describe("recommended order", () => {
  const app = (url, manifest) => ({ sourceUrl: url, versions: [{ version: "v1", createdAt: "2026-01-01", manifest }] });
  const applications = [app("https://github.com/a/declared", { tags: [] }), app("https://github.com/a/bare", null)];
  const wf = (name, extra) => ({ name, createdAt: "2026-01-01", dag: [], ...extra });
  const step = (url) => ({ id: url, sourceUrl: url });

  it("puts official, then active, then declared apps first, then the most run", () => {
    const list = [
      wf("bare", { isActive: true, dag: [step("https://github.com/a/bare")], metrics: { totalRuns: 50 } }),
      wf("declared", { isActive: true, dag: [step("https://github.com/a/declared/")], metrics: { totalRuns: 1 } }),
      wf("inactive", { isActive: false, metrics: { totalRuns: 99 } }),
      wf("official", { official: true, isActive: true }),
      wf("busy", { isActive: true, dag: [step("https://github.com/a/declared")], metrics: { totalRuns: 5 } }),
    ];
    expect(sortWorkflows(list, "recommended", { applications }).map((w) => w.name)).toEqual([
      "official",
      "busy",
      "declared",
      "bare",
      "inactive",
    ]);
  });
});

describe("workflowsView", () => {
  it("is the URL's view, else the one last used here, else Library", () => {
    expect(workflowsView("live", "builder")).toBe("live");
    expect(workflowsView(undefined, "builder")).toBe("builder");
    expect(workflowsView(undefined, null)).toBe("library");
    // A first visit: Live when there are runs to see, the Library when none.
    expect(workflowsView(undefined, null, true)).toBe("live");
    expect(workflowsView(undefined, "library", true)).toBe("library");
    expect(workflowsView("apps", "nonsense")).toBe("library");
  });
});

