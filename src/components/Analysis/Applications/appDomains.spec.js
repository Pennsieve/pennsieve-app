import { describe, it, expect } from "vitest";
import { appBanner, canonicalTag, domainOf, domainOfTag, fitTypes, SUGGESTED_TAGS } from "./appDomains";

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
    expect(domainOf(null)).toBeNull();
  });

  it("reads an old app.yml's categories as tags, in the known spelling", async () => {
    const { parseManifest } = await import("./applicationSchema");
    const { schema } = parseManifest("application:\n  name: x\n  tags: [seurat]\n  categories: [Visualization, Single Cell]\n");
    expect(schema.tags).toEqual(["seurat", "visualization", "single-cell"]);
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
    expect(b).toMatchObject({ manifest: true, hue: 255, inputs: ["EDF", "NWB"], outputs: ["CSV", "PNG"] });
    expect(b.domain.key).toBe("ephys");
  });

  it("colours an app without a domain by its name, as the tiles do", () => {
    const a = appBanner(withManifest({ tags: ["penn"] }));
    expect(a.domain).toBeNull();
    expect(a.hue).toBe(appBanner(withManifest({}, "spike-detect")).hue);
    expect(appBanner({ name: "spike-detect", versions: [] })).toMatchObject({ manifest: false, inputs: [], outputs: [] });
  });
});
