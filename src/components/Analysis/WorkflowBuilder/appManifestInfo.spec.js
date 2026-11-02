import { describe, it, expect } from "vitest";
import {
  versionManifest,
  manifestsServed,
  shortMediaType,
  ioLine,
  fitsAfter,
  paletteGroups,
  matchesApp,
  sessionTypeOf,
  variantsOf,
  defaultVariant,
  paletteVariants,
  stepVariant,
} from "./appManifestInfo";

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
    expect(shortMediaType("application/vnd.apache.parquet")).toBe("PARQUET");
    expect(shortMediaType("application/x-rds")).toBe("RDS");
    expect(shortMediaType("application/octet-stream")).toBe("File");
    expect(shortMediaType("application/vnd.pennsieve.open-ephys")).toBe("OPEN-EPHYS");
    expect(shortMediaType("application/vnd.pennsieve.ome-zarr")).toBe("OME-ZARR");
    expect(shortMediaType("application/vnd.pennsieve.nwb-zarr")).toBe("NWB-ZARR");
    expect(shortMediaType("application/x-nifti-gz")).toBe("NIFTI");
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
  it("puts interactive apps (notebook kernels) in their own group, last", () => {
    const declares = (runtime) => [{ version: "v1", createdAt: "x", manifest: { runtime } }];
    const jupyter = { uuid: "4", sourceUrl: "https://github.com/Pennsieve/pennsieve-jupyter-session", versions: declares({ interactive: true, sessionType: "jupyter", kernel: "python" }) };
    const rSession = { uuid: "5", sourceUrl: "https://github.com/Pennsieve/pennsieve-r-session.git", versions: declares({ interactive: true, sessionType: "jupyter", kernel: "r" }) };
    const undeclared = { uuid: "7", sourceUrl: "https://github.com/Pennsieve/pennsieve-jupyter-session-old", versions: [] };
    expect(sessionTypeOf(jupyter)).toBe("jupyter");
    expect(sessionTypeOf(rSession)).toBe("jupyter");
    expect(sessionTypeOf(undeclared)).toBeNull();
    expect(sessionTypeOf(plot)).toBeNull();
    // Only interactive: true makes an app live; a session type alone doesn't.
    const typeOnly = { uuid: "6", sourceUrl: "https://github.com/o/my-viewer", versions: [{ version: "v1", createdAt: "x", manifest: { runtime: { sessionType: "jupyter" } } }] };
    expect(sessionTypeOf(typeOnly)).toBeNull();
    const flagged = { ...typeOnly, versions: [{ version: "v1", createdAt: "x", manifest: { runtime: { interactive: true } } }] };
    expect(sessionTypeOf(flagged)).toBe("jupyter");
    const groups = paletteGroups([plot, jupyter, rSession], { name });
    expect(groups.map((g) => [g.key, g.apps.length])).toEqual([["all", 1], ["interactive", 2]]);
    expect(groups[1].note).toMatch("pauses");
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

// DynaSD with a CPU (default) and a GPU variant, as app-deploy-service stores
// them (a map by id) in v0.3.0; v0.2.2 has none.
const dynasdPorts = { inputs: [{ name: "ieeg", mediaTypes: ["application/edf"] }], outputs: [{ name: "onsets", mediaTypes: ["text/csv"] }] };
const dynasdManifest = (variant, runtime, model) => ({
  name: "Seizure Onset (DynaSD)",
  description: "Finds when a seizure starts",
  runtime: { cpu: 4096, ...runtime },
  parameters: [{ name: "MODEL", type: "string", defaultValue: model, validValues: ["lindda", "oncet"] }],
  ...dynasdPorts,
  ...(variant && { variant }),
});
const cpuManifest = dynasdManifest({ id: "cpu", name: "CPU" }, { memory: 8192, computeTypes: ["standard"] }, "lindda");
const gpuManifest = dynasdManifest(
  { id: "gpu", name: "GPU (ONCET)", description: "CUDA PyTorch on an NVIDIA T4" },
  { memory: 14336, computeTypes: ["gpu"] },
  "oncet"
);
const dynasd = {
  uuid: "9",
  sourceUrl: "https://github.com/Pennsieve/processor-seizure-dynasd",
  versions: [
    { version: "v0.2.2", createdAt: "2026-10-01", manifest: dynasdManifest(null, { memory: 8192, computeTypes: ["standard"] }, "lindda") },
    {
      version: "v0.3.0",
      createdAt: "2026-10-29",
      manifest: cpuManifest,
      defaultVariant: "cpu",
      variantOrder: ["cpu", "gpu"],
      variants: {
        gpu: { name: "GPU (ONCET)", description: "CUDA PyTorch on an NVIDIA T4", manifest: gpuManifest, build: { args: { TORCH_FLAVOUR: "cuda" } } },
        cpu: { name: "CPU", manifest: cpuManifest, build: { args: { TORCH_FLAVOUR: "cpu" } } },
      },
    },
  ],
};

describe("variants", () => {
  it("lists a version's variants in order, with the default and GPU marks", () => {
    expect(variantsOf(dynasd).map((v) => [v.id, v.name, v.default, v.gpu])).toEqual([
      ["cpu", "CPU", true, false],
      ["gpu", "GPU (ONCET)", false, true],
    ]);
    expect(variantsOf(dynasd, "v0.3.0")[1]).toMatchObject({ description: "CUDA PyTorch on an NVIDIA T4", computeTypes: ["gpu"] });
    expect(variantsOf(dynasd, "v0.2.2")).toEqual([]);
    expect(variantsOf(spike)).toEqual([]);
    expect(variantsOf(null)).toEqual([]);
  });

  it("knows the default variant: declared, else marked, else the first", () => {
    expect(defaultVariant(dynasd)).toBe("cpu");
    expect(defaultVariant(dynasd, "v0.2.2")).toBe("");
    const listed = (variants, extra = {}) => ({ versions: [{ version: "v1", createdAt: "x", manifest: {}, variants, ...extra }] });
    // The API's list form: [{ id, …, default }].
    expect(defaultVariant(listed([{ id: "a" }, { id: "b", default: true }]))).toBe("b");
    expect(defaultVariant(listed([{ id: "a" }, { id: "b" }]))).toBe("a");
    expect(defaultVariant(listed({ b: {}, a: {} }, { defaultVariant: "b" }))).toBe("b");
    // A map without an order: by id.
    expect(variantsOf(listed({ b: {}, a: {} })).map((v) => v.id)).toEqual(["a", "b"]);
    // A name falls back to the resolved manifest's, then to the id.
    expect(variantsOf(listed([{ id: "a", manifest: { variant: { id: "a", name: "Alpha" } } }, { id: "b" }])).map((v) => v.name)).toEqual(["Alpha", "b"]);
  });

  it("gives a variant's manifest, the default's without one", () => {
    expect(versionManifest(dynasd, "v0.3.0", "gpu").runtime.computeTypes).toEqual(["gpu"]);
    expect(versionManifest(dynasd, "v0.3.0", "gpu").parameters[0].defaultValue).toBe("oncet");
    expect(versionManifest(dynasd, "v0.3.0")).toBe(cpuManifest);
    expect(versionManifest(dynasd, "v0.3.0", "")).toBe(cpuManifest);
    expect(versionManifest(dynasd, undefined, "gpu")).toBe(gpuManifest);
    // A variant the version doesn't have: the version's manifest.
    expect(versionManifest(dynasd, "v0.3.0", "tpu")).toBe(cpuManifest);
    expect(versionManifest(dynasd, "v0.2.2", "gpu").variant).toBeUndefined();
    expect(versionManifest(bare, "v1", "gpu")).toBeNull();
  });

  it("offers chips only for two or more variants", () => {
    expect(paletteVariants(dynasd).map((v) => v.id)).toEqual(["cpu", "gpu"]);
    expect(paletteVariants(spike)).toEqual([]);
    const one = { versions: [{ version: "v1", createdAt: "x", manifest: {}, variants: [{ id: "only" }] }] };
    expect(paletteVariants(one)).toEqual([]);
  });

  it("keeps a step's variant only when it isn't the default and the version has it", () => {
    expect(stepVariant(dynasd, "v0.3.0", "gpu")).toBe("gpu");
    expect(stepVariant(dynasd, "v0.3.0", "cpu")).toBe("");
    expect(stepVariant(dynasd, "v0.3.0", "")).toBe("");
    expect(stepVariant(dynasd, "v0.3.0", undefined)).toBe("");
    expect(stepVariant(dynasd, "v0.3.0", "tpu")).toBe("");
    expect(stepVariant(dynasd, "v0.2.2", "gpu")).toBe("");
  });

  it("is one palette entry, found by its variants' names", () => {
    const dName = (a) => versionManifest(a)?.name || a.sourceUrl;
    expect(paletteGroups([dynasd, plot], { name: dName }).flatMap((g) => g.apps)).toHaveLength(2);
    expect(matchesApp(dynasd, "oncet", dName)).toBe(true);
    expect(matchesApp(dynasd, "gpu", dName)).toBe(true);
    expect(matchesApp(dynasd, "t4", dName)).toBe(true);
    expect(matchesApp(spike, "gpu", name)).toBe(false);
  });
});
