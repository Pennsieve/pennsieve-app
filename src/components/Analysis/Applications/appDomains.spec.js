import { describe, it, expect } from "vitest";
import { appBanner, canonicalTag, domainColors, domainCounts, domainOf, domainOfTag, DOMAINS, fitTypes, NEUTRAL_COLORS, SUGGESTED_TAGS } from "./appDomains";

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
