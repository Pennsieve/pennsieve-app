import { describe, it, expect } from "vitest";
import { appBanner, appFields, canonicalTag, fieldCounts, fieldOfTag, fieldsOf, FIELDS, domainColors, domainCounts, domainOf, domainOfTag, DOMAINS, fitTypes, NEUTRAL_COLORS, SUGGESTED_TAGS, preferredTagGroups, tagOptionMatches, tagDomainNudge, hasDomainTag } from "./appDomains";

const withManifest = (manifest, name = "spike-detect") => ({
  name,
  versions: [{ version: "1.0.0", createdAt: "2026-01-01", manifest }],
});

describe("banner types", () => {
  it("shows what fits on one row, then how many more", () => {
    expect(fitTypes(["EDF", "NWB"])).toEqual({ types: ["EDF", "NWB"], more: 0 });
    expect(fitTypes(["PARQUET", "PARQUET2", "PARQUET3"])).toEqual({ types: ["PARQUET"], more: 2 });
    expect(fitTypes(["EDF", "NWB", "CSV", "PNG", "JSON"])).toEqual({ types: ["EDF", "NWB"], more: 3 });
    expect(fitTypes(["NEURODATAWITHOUTBORDERS"])).toEqual({ types: ["NEURODATAWITHOUTBORDERS"], more: 0 });
    expect(fitTypes([])).toEqual({ types: [], more: 0 });
  });
});

describe("app domains", () => {
  it("matches a tag however it's spelled", () => {
    expect(domainOfTag("EEG").key).toBe("ephys");
    expect(domainOfTag("Spike Sorting").key).toBe("spikes");
    expect(domainOfTag("spike_sorting").key).toBe("spikes");
    expect(domainOfTag("Machine-Learning").key).toBe("ml");
    expect(domainOfTag("my-lab")).toBeNull();
    expect(domainOfTag("Pre-processing").key).toBe("preprocessing");
    expect(domainOfTag("Reporting").key).toBe("report");
  });

  it("takes the first subject named, else the first task, else a live session's", () => {
    expect(domainOf({ tags: ["penn", "MRI", "eeg"] }).key).toBe("imaging");
    expect(domainOf({ tags: ["penn"] })).toBeNull();
    expect(domainOf({ tags: ["Single Cell", "eeg"] }).key).toBe("genomics");
    expect(domainOf({ tags: ["utility", "visualization"] }).key).toBe("viz");
    // A subject wins over a task, wherever it's named.
    expect(domainOf({ tags: ["visualization", "single-cell"] }).key).toBe("genomics");
    expect(domainOf({ tags: ["statistics", "eeg"] }).key).toBe("ephys");
    expect(domainOf({ tags: ["statistics", "visualization"] }).key).toBe("stats");
    expect(domainOf({ tags: ["Format Conversion"] }).key).toBe("convert");
    expect(domainOf({ tags: [], runtime: { interactive: true } }).key).toBe("notebook");
    expect(domainOf({ tags: [], runtime: { interactive: true, sessionType: "jupyter", kernel: "r" } }).key).toBe("notebook");
    // Another kind of live session isn't a notebook.
    expect(domainOf({ tags: [], runtime: { interactive: true, sessionType: "webapp" } })).toBeNull();
    expect(domainOf(null)).toBeNull();
  });

  it("reads tags only, not the deprecated categories", async () => {
    const { parseManifest } = await import("./applicationSchema");
    const { schema } = parseManifest("application:\n  name: x\n  tags: [seurat, EEG]\n  categories: [Visualization]\n");
    expect(schema.tags).toEqual(["seurat", "eeg"]);
  });

  it("lands typed tags on the suggestion they spell", () => {
    expect(canonicalTag(" EEG ")).toBe("eeg");
    expect(canonicalTag("Machine Learning")).toBe("machine-learning");
    expect(canonicalTag("My Lab")).toBe("My Lab");
    expect(new Set(SUGGESTED_TAGS).size).toBe(SUGGESTED_TAGS.length);
  });

  it("pictures an app from its app.yml", () => {
    const b = appBanner(
      withManifest({
        tags: ["eeg"],
        inputs: [{ name: "recording", mediaTypes: ["application/edf", "application/x-nwb"] }],
        outputs: [{ name: "spikes", mediaTypes: ["text/csv"] }, { name: "plot", mediaTypes: ["image/png", "text/csv"] }],
      })
    );
    expect(b).toMatchObject({ manifest: true, inputs: ["EDF", "NWB"], outputs: ["CSV", "PNG"] });
    expect(b.colors).toEqual(domainColors(b.domain));
    expect(b.domain.key).toBe("ephys");
  });

  it("greys an app without a domain: a colour always means one", () => {
    const a = appBanner(withManifest({ tags: ["penn"] }));
    expect(a.domain).toBeNull();
    expect(a.colors).toBe(NEUTRAL_COLORS);
    expect(appBanner({ name: "spike-detect", versions: [] })).toMatchObject({ manifest: false, colors: NEUTRAL_COLORS, inputs: [], outputs: [] });
  });

  it("colours subjects strongly and tasks quietly, each its own", () => {
    const sat = (c) => Number(/hsl\(\d+, (\d+)%/.exec(c.accent)[1]);
    expect(sat(domainColors(domainOfTag("eeg")))).toBeGreaterThan(sat(domainColors(domainOfTag("visualization"))));
    const accents = DOMAINS.map((d) => domainColors(d).accent);
    expect(new Set(accents).size).toBe(DOMAINS.length);
    expect(NEUTRAL_COLORS.accent).toBeNull();
  });

  it("counts the domains among apps, subjects first", () => {
    const chips = domainCounts([
      withManifest({ tags: ["visualization"] }, "a"),
      withManifest({ tags: ["visualization"] }, "b"),
      withManifest({ tags: ["eeg"] }, "c"),
      withManifest({ tags: ["penn"] }, "d"),
    ]);
    expect(chips.map((c) => [c.domain.key, c.count])).toEqual([["ephys", 1], ["viz", 2]]);
  });
});

describe("cytometry", () => {
  it("is a subject of its own, by any of its spellings", () => {
    for (const t of ["cytometry", "Flow Cytometry", "spectral-flow", "CyTOF", "mass_cytometry", "FCS", "immunophenotyping"]) {
      expect(domainOfTag(t).key).toBe("cytometry");
    }
    expect(domainOfTag("cytometry").subject).toBe(true);
    // A subject wins over a task named first.
    expect(domainOf({ tags: ["preprocessing", "fcs"] }).key).toBe("cytometry");
  });
});

describe("research fields", () => {
  const cytometryApp = withManifest({ tags: ["cytometry", "flow-cytometry", "spectral-flow", "mass-cytometry", "fcs", "preprocessing", "immunology"] }, "fcs-qc");
  const mriApp = withManifest({ tags: ["neuroimaging", "mri", "nifti", "synthstrip", "freesurfer", "skull-stripping"] }, "skull-strip");

  it("matches a tag however it's spelled, apart from domains", () => {
    expect(fieldOfTag("Neuroscience").key).toBe("neuroscience");
    expect(fieldOfTag("epilepsy").key).toBe("neuroscience");
    expect(fieldOfTag("Immuno-Oncology").key).toBe("immunology");
    expect(fieldOfTag("tumour").key).toBe("oncology");
    expect(fieldOfTag("cardiac").key).toBe("cardiology");
    expect(fieldOfTag("eeg")).toBeNull();
    expect(domainOfTag("neuroscience")).toBeNull();
  });

  it("counts a tag for both axes where it belongs to both", () => {
    expect(domainOfTag("neuroimaging").key).toBe("imaging");
    expect(fieldOfTag("neuroimaging").key).toBe("neuroscience");
    expect(domainOfTag("immunophenotyping").key).toBe("cytometry");
    expect(fieldOfTag("immunophenotyping").key).toBe("immunology");
    expect(domainOfTag("neurophysiology").key).toBe("ephys");
    expect(fieldOfTag("neurophysiology").key).toBe("neuroscience");
  });

  it("reads the demo apps: cytometry for immunology, imaging for neuroscience", () => {
    expect(appBanner(cytometryApp).domain.key).toBe("cytometry");
    expect(appFields(cytometryApp).map((f) => f.key)).toEqual(["immunology"]);
    expect(appBanner(mriApp).domain.key).toBe("imaging");
    expect(appFields(mriApp).map((f) => f.key)).toEqual(["neuroscience"]);
  });

  it("gives an app several fields, once each, in the order named", () => {
    expect(fieldsOf({ tags: ["cancer", "immune", "immunology", "eeg"] }).map((f) => f.key)).toEqual(["oncology", "immunology"]);
    expect(fieldsOf({ tags: ["penn"] })).toEqual([]);
    expect(fieldsOf(null)).toEqual([]);
  });

  it("never colours: the colour stays the domain's", () => {
    const a = appBanner(withManifest({ tags: ["neuroscience"] }));
    expect(a.domain).toBeNull();
    expect(a.colors).toBe(NEUTRAL_COLORS);
    expect(FIELDS.some((f) => "hue" in f)).toBe(false);
  });

  it("counts the fields among apps, an app once per field", () => {
    const chips = fieldCounts([
      cytometryApp,
      mriApp,
      withManifest({ tags: ["epilepsy", "eeg", "cardiac"] }, "c"),
      withManifest({ tags: ["penn"] }, "d"),
    ]);
    expect(chips.map((c) => [c.field.key, c.count])).toEqual([["neuroscience", 2], ["cardiology", 1], ["immunology", 1]]);
  });

  it("suggests field tags as their own group, found by alias", () => {
    const { fields } = preferredTagGroups();
    expect(fields.map((o) => o.tag)).toEqual(FIELDS.map((f) => f.tag));
    const neuro = fields.find((o) => o.tag === "neuroscience");
    expect(tagOptionMatches(neuro, "epilep", { preferred: true })).toBe(true);
    expect(tagOptionMatches(neuro, "cancer", { preferred: true })).toBe(false);
    expect(canonicalTag("Clinical Research")).toBe("clinical-research");
    expect(canonicalTag("Immunology")).toBe("immunology");
  });

  it("nudges a domain's tag before a field's", () => {
    expect(tagDomainNudge(["epilepsy", "eeg"])).toMatchObject({ tag: "electrophysiology", label: "Electrophysiology" });
    expect(tagDomainNudge(["epilepsy", "eeg", "electrophysiology"])).toMatchObject({ tag: "neuroscience", label: "Neuroscience" });
    expect(tagDomainNudge(["imaging", "neuroimaging", "neuroscience"])).toBeNull();
  });
});

describe("preferred tags", () => {
  it("lists each domain's tag, subjects first, in DOMAINS order", () => {
    const { preferred, aliases } = preferredTagGroups();
    expect(preferred).toHaveLength(DOMAINS.length);
    const subjects = DOMAINS.filter((d) => d.subject).map((d) => d.tag);
    expect(preferred.slice(0, subjects.length).map((o) => o.tag)).toEqual(subjects);
    expect(aliases.find((o) => o.tag === "eeg").domain.tag).toBe("electrophysiology");
    expect(aliases.some((o) => o.tag === o.domain.tag)).toBe(false);
  });
  it("matches a preferred tag by its aliases and label", () => {
    const { preferred } = preferredTagGroups();
    const spikes = preferred.find((o) => o.tag === "spike-sorting");
    expect(tagOptionMatches(spikes, "spike", { preferred: true })).toBe(true);
    expect(tagOptionMatches(spikes, "kilosort", { preferred: true })).toBe(true);
    expect(tagOptionMatches(spikes, "kilosort")).toBe(false);
    expect(tagOptionMatches(spikes, "")).toBe(true);
  });
  it("suggests the preferred tag for an alias's domain, once", () => {
    expect(tagDomainNudge(["eeg"])).toMatchObject({ tag: "electrophysiology" });
    expect(tagDomainNudge(["eeg", "electrophysiology"])).toBeNull();
    expect(tagDomainNudge(["my-lab-tool"])).toBeNull();
    expect(tagDomainNudge([])).toBeNull();
  });
  it("knows whether any tag gives the card a colour", () => {
    expect(hasDomainTag(["my-lab-tool"])).toBe(false);
    expect(hasDomainTag(["qc"])).toBe(true);
  });
});

