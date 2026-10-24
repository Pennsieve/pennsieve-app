import { describe, it, expect } from "vitest";
import { appBanner, canonicalTag, domainOf, domainOfTag, SUGGESTED_TAGS } from "./appDomains";

const withManifest = (manifest, name = "spike-detect") => ({
  name,
  versions: [{ version: "1.0.0", createdAt: "2026-01-01", manifest }],
});

describe("app domains", () => {
  it("matches a tag however it's spelled", () => {
    expect(domainOfTag("EEG").key).toBe("ephys");
    expect(domainOfTag("Spike Sorting").key).toBe("spikes");
    expect(domainOfTag("spike_sorting").key).toBe("spikes");
    expect(domainOfTag("Machine-Learning").key).toBe("ml");
    expect(domainOfTag("my-lab")).toBeNull();
  });

  it("takes the first tag that names a domain, else a live session's", () => {
    expect(domainOf({ tags: ["penn", "MRI", "eeg"] }).key).toBe("imaging");
    expect(domainOf({ tags: ["penn"] })).toBeNull();
    expect(domainOf({ categories: ["Single Cell"], tags: ["eeg"] }).key).toBe("genomics");
    expect(domainOf({ categories: ["Utility", "Visualization"] }).key).toBe("viz");
    expect(domainOf({ categories: ["Format Conversion"] }).key).toBe("convert");
    expect(domainOf({ tags: [], runtime: { interactive: true } }).key).toBe("notebook");
    expect(domainOf(null)).toBeNull();
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
