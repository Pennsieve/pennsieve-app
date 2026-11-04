import { describe, it, expect } from "vitest";
import { activeFilters, applyFilters, domainOptions, FACET_DEFAULTS, fieldOptions, inheritedTags, libraryWorkflows, workflowDomains, workflowFields, matchesSearch, outputOptions, sortWorkflows, workflowsView } from "./galleryFilter";

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

  it("matches the workflow's own tags", () => {
    const tagged = { ...zipper, tags: ["quality-control", "Cytometry"] };
    expect(matchesSearch(tagged, "cytometry")).toBe(true);
    expect(matchesSearch(tagged, "quality zip")).toBe(true);
    expect(matchesSearch(zipper, "cytometry")).toBe(false);
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

  it("are the workflow's own tags' when it has tags", () => {
    // Tagged: its tags alone, so a tag can narrow what its apps would say.
    const tagged = { ...cyto, tags: ["oncology", "quality-control"] };
    expect(workflowFields(tagged, applications).map((f) => f.key)).toEqual(["oncology"]);
    expect(workflowFields({ ...zipper, tags: ["Neuroscience"] }, applications).map((f) => f.key)).toEqual(["neuroscience"]);
    // Tags that name no field: none, not the apps'.
    expect(workflowFields({ ...cyto, tags: ["quality-control"] }, applications)).toEqual([]);
    expect(applyFilters([spikes, zipper, tagged], { field: "oncology", applications })).toEqual([tagged]);
    expect(applyFilters([spikes, zipper, tagged], { field: "immunology", applications })).toEqual([]);
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

describe("domains", () => {
  const app = (url, tags) => ({ sourceUrl: url, versions: [{ version: "v1", createdAt: "2026-01-01", manifest: { tags } }] });
  const applications = [
    app("https://github.com/org/spike-detect", ["electrophysiology", "epilepsy"]),
    app("https://github.com/org/tumour-map", ["imaging", "visualization"]),
  ];
  const step = (url) => ({ id: url, type: "processor", sourceUrl: url });
  const tumours = { name: "Tumours", tags: ["Visualization"], dag: [step("https://github.com/org/tumour-map")] };

  it("are the workflow's own tags' domains, else its apps'", () => {
    // Tagged: its tags alone (the app is Imaging; the workflow says Visualization).
    expect(workflowDomains(tumours, applications).map((d) => d.key)).toEqual(["viz"]);
    // Untagged: its apps'.
    expect(workflowDomains(spikes, applications).map((d) => d.key)).toEqual(["ephys"]);
    expect(workflowDomains({ ...tumours, tags: [] }, applications).map((d) => d.key)).toEqual(["imaging"]);
    expect(workflowDomains(zipper, applications)).toEqual([]);
  });

  it("offers the domains the list has, subjects first", () => {
    expect(domainOptions([spikes, zipper, tumours], applications).map((o) => [o.domain.key, o.count])).toEqual([
      ["ephys", 1],
      ["viz", 1],
    ]);
  });

  it("shows an untagged workflow its apps' domains and fields as tags", () => {
    expect(inheritedTags({ ...tumours, tags: [] }, applications)).toEqual(["imaging"]);
    expect(inheritedTags(spikes, applications)).toEqual(["electrophysiology", "neuroscience"]);
    expect(inheritedTags(zipper, applications)).toEqual([]);
    // A tagged workflow shows its own.
    expect(inheritedTags(tumours, applications)).toEqual([]);
  });

  it("filters by domain, with the other filters", () => {
    expect(applyFilters([spikes, zipper, tumours], { domain: "viz", applications })).toEqual([tumours]);
    expect(applyFilters([spikes, zipper, tumours], { domain: "imaging", applications })).toEqual([]);
    expect(applyFilters([spikes, zipper, tumours], { domain: "ephys", input: "none", applications })).toEqual([]);
    expect(applyFilters([spikes, zipper, tumours], { domain: "any", applications })).toEqual([spikes, zipper, tumours]);
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


describe("activeFilters", () => {
  const domains = [{ domain: { key: "genomics", label: "Genomics" }, count: 8 }];
  const fields = [{ field: { key: "neuroscience", label: "Neuroscience" }, count: 6 }];
  const outputs = [{ value: "download", label: "Download" }];

  it("is empty with every facet at its default", () => {
    expect(activeFilters(FACET_DEFAULTS, { domains, fields, outputs })).toEqual([]);
    expect(activeFilters({}, { domains, fields, outputs })).toEqual([]);
  });

  it("names each facet set, in the panel's order", () => {
    const state = { domain: "genomics", field: "neuroscience", input: "dataset", output: "download", status: "archived" };
    expect(activeFilters(state, { domains, fields, outputs })).toEqual([
      { key: "status", label: "Status: Archived" },
      { key: "domain", label: "Genomics" },
      { key: "field", label: "Neuroscience" },
      { key: "input", label: "Takes a dataset" },
      { key: "output", label: "Output: Download" },
    ]);
  });

  it("names a value no longer offered by its key", () => {
    expect(activeFilters({ ...FACET_DEFAULTS, domain: "imaging", output: "s3" }, { domains, fields, outputs })).toEqual([
      { key: "domain", label: "imaging" },
      { key: "output", label: "Output: s3" },
    ]);
  });

  it("counts the status only away from Active", () => {
    expect(activeFilters({ ...FACET_DEFAULTS, status: "all" })).toEqual([{ key: "status", label: "Status: All" }]);
  });
});
