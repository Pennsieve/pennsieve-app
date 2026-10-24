import { describe, it, expect } from "vitest";
import { versionManifest, manifestsServed, shortMediaType, ioLine, fitsAfter, paletteGroups, matchesApp } from "./appManifestInfo";

const edfToJson = { name: "spike", description: "Finds spikes", tags: ["eeg"], inputs: [{ name: "rec", mediaTypes: ["application/edf"] }], outputs: [{ name: "ev", mediaTypes: ["application/json"] }] };
const jsonToPng = { name: "plot", inputs: [{ name: "in", mediaTypes: ["application/json"] }], outputs: [{ name: "out", mediaTypes: ["image/png"] }] };
const spike = { uuid: "1", ownerId: "me", sourceUrl: "https://github.com/o/spike", versions: [
  { version: "v1", createdAt: "2026-01-01", manifest: { ...edfToJson, name: "spike-old" } },
  { version: "v2", createdAt: "2026-02-01", manifest: edfToJson },
] };
const plot = { uuid: "2", sourceUrl: "https://github.com/o/plot", versions: [{ version: "v1", createdAt: "2026-01-01", manifest: jsonToPng }] };
const bare = { uuid: "3", sourceUrl: "https://github.com/o/bare", versions: [{ version: "v1", createdAt: "2026-01-01" }] };
const name = (a) => versionManifest(a)?.name || a.sourceUrl.split("/").pop();

describe("versionManifest", () => {
  it("is a version's manifest, else the newest one with a manifest", () => {
    expect(versionManifest(spike).name).toBe("spike");
    expect(versionManifest(spike, "v1").name).toBe("spike-old");
    expect(versionManifest(bare)).toBeNull();
    expect(versionManifest(bare, "v1")).toBeNull();
  });
  it("knows whether manifests are served at all", () => {
    expect(manifestsServed([bare])).toBe(false);
    expect(manifestsServed([bare, plot])).toBe(true);
  });
});

describe("media types", () => {
  it("shortens them for display", () => {
    expect(shortMediaType("application/edf")).toBe("EDF");
    expect(shortMediaType("application/vnd.nifti+gzip")).toBe("NIFTI");
    expect(shortMediaType("*/*")).toBe("Any");
    expect(ioLine(edfToJson)).toBe("EDF → JSON");
    expect(ioLine({ inputs: [], outputs: [] })).toBe("");
    expect(ioLine(null)).toBe("");
  });
});

describe("fitsAfter and paletteGroups", () => {
  it("puts apps that accept the selected step's output first", () => {
    expect(fitsAfter(edfToJson, jsonToPng)).toBe("fits");
    expect(fitsAfter(jsonToPng, edfToJson)).toBe("no");
    expect(fitsAfter(null, jsonToPng)).toBe("unknown");
    const groups = paletteGroups([spike, plot, bare], { stepPorts: edfToJson, me: "me", name });
    expect(groups.map((g) => [g.key, g.apps.map(name)])).toEqual([
      ["fits", ["plot"]],
      ["yours", ["spike"]],
      ["all", ["bare"]],
    ]);
  });
  it("is one list with nothing selected and nothing of the user's", () => {
    expect(paletteGroups([plot, bare], { name }).map((g) => [g.key, g.label])).toEqual([["all", "Apps"]]);
  });
});

describe("matchesApp", () => {
  it("searches name, description, tags and media types", () => {
    expect(matchesApp(spike, "eeg", name)).toBe(true);
    expect(matchesApp(spike, "edf", name)).toBe(true);
    expect(matchesApp(plot, "png json", name)).toBe(true);
    expect(matchesApp(bare, "edf", name)).toBe(false);
    expect(matchesApp(bare, "bare", name)).toBe(true);
  });
});
