import { describe, it, expect } from "vitest";
import {
  effectiveVariant,
  modelLine,
  modelLineText,
  nodesHaveGpus,
  switchableVariants,
  switchVariant,
  titleWithVariant,
  variantFallback,
  variantName,
  variantParamNote,
  variantSetParams,
  variantUnavailable,
} from "./appVariants";

// DynaSD: v0.3.0 has a CPU (default, MODEL lindda) and a GPU variant (MODEL
// oncet, 14 GiB); v0.2.2 has none. As the API lists them.
const ports = { inputs: [{ name: "ieeg", mediaTypes: ["application/edf"] }], outputs: [{ name: "onsets", mediaTypes: ["text/csv"] }] };
const manifest = (variant, runtime, model) => ({
  name: "Seizure Onset (DynaSD)",
  runtime: { cpu: 4096, ...runtime },
  parameters: [
    { name: "MODEL", label: "Detector", type: "string", defaultValue: model, validValues: ["lindda", "oncet"] },
    { name: "DEVICE", type: "string", defaultValue: "auto" },
  ],
  ...ports,
  ...(variant && { variant }),
});
const cpu = manifest({ id: "cpu", name: "CPU" }, { memory: 8192, computeTypes: ["standard"] }, "lindda");
const gpu = manifest({ id: "gpu", name: "GPU (ONCET)" }, { memory: 14336, computeTypes: ["gpu"] }, "oncet");
const dynasd = {
  sourceUrl: "https://github.com/Pennsieve/processor-seizure-dynasd",
  versions: [
    { version: "v0.2.2", createdAt: "2026-10-01", manifest: manifest(null, { memory: 8192, computeTypes: ["standard"] }, "lindda") },
    {
      version: "v0.3.0",
      createdAt: "2026-10-29",
      manifest: cpu,
      defaultVariant: "cpu",
      variants: [
        { id: "cpu", name: "CPU", default: true, status: "deployed", manifest: cpu },
        { id: "gpu", name: "GPU (ONCET)", default: false, status: "deployed", manifest: gpu },
      ],
    },
  ],
};
const plain = { versions: [{ version: "v1", createdAt: "x", manifest: { name: "spike", parameters: [{ name: "T", defaultValue: 3 }] } }] };

describe("a step's variant", () => {
  it("is named on the card only when the version has variants", () => {
    expect(switchableVariants(dynasd, "v0.3.0").map((v) => v.id)).toEqual(["cpu", "gpu"]);
    expect(effectiveVariant(dynasd, "v0.3.0", "").id).toBe("cpu");
    expect(effectiveVariant(dynasd, "v0.3.0", "gpu").id).toBe("gpu");
    expect(variantName(dynasd, "v0.3.0", "gpu")).toBe("GPU (ONCET)");
    expect(titleWithVariant("DynaSD", dynasd, "v0.3.0", "")).toBe("DynaSD · CPU");
    expect(titleWithVariant("DynaSD", dynasd, "v0.2.2", "")).toBe("DynaSD");
    expect(titleWithVariant("spike", plain, "v1", "")).toBe("spike");
    expect(effectiveVariant(plain, "v1", "")).toBeNull();
  });

  it("shows the parameters the variants set differently, with the step's value", () => {
    expect(variantSetParams(dynasd, "v0.3.0")).toEqual(["MODEL"]);
    expect(variantSetParams(dynasd, "v0.2.2")).toEqual([]);
    expect(variantSetParams(plain, "v1")).toEqual([]);
    expect(modelLineText(modelLine(dynasd, "v0.3.0", ""))).toBe("Detector: lindda");
    expect(modelLineText(modelLine(dynasd, "v0.3.0", "gpu"))).toBe("Detector: oncet");
    // The step's own value, whichever variant.
    expect(modelLine(dynasd, "v0.3.0", "gpu", { MODEL: "lindda" })).toEqual([
      { name: "MODEL", label: "Detector", value: "lindda", edited: true },
    ]);
    expect(modelLine(plain, "v1", "", { T: 4 })).toEqual([]);
  });

  it("says what each variant defaults a parameter to, its own first", () => {
    expect(variantParamNote(dynasd, "v0.3.0", "gpu", "MODEL")).toBe(
      "The GPU (ONCET) variant defaults this to oncet; the CPU variant to lindda."
    );
    expect(variantParamNote(dynasd, "v0.3.0", "", "MODEL")).toBe(
      "The CPU variant defaults this to lindda; the GPU (ONCET) variant to oncet."
    );
    expect(variantParamNote(plain, "v1", "", "T")).toBe("");
  });
});

describe("switching variants", () => {
  const step = { tag: "v0.3.0", computeType: "standard", cpu: "4096", memory: "8192", defaultParams: {} };

  it("moves the compute type, resources and untouched defaults to the variant", () => {
    const s = switchVariant(step, dynasd, "gpu");
    expect(s).toMatchObject({ variant: "gpu", computeType: "gpu", cpu: "4096", memory: "14336", kept: [], portLines: [] });
    expect(s.manifest.parameters[0].defaultValue).toBe("oncet");
  });

  it("writes no variant for the default, and comes back to its resources", () => {
    const back = switchVariant({ ...step, variant: "gpu", computeType: "gpu", memory: "14336" }, dynasd, "cpu");
    expect(back).toMatchObject({ variant: "", computeType: "standard", memory: "8192" });
  });

  it("raises resources the step set itself to the variant's, never lowers them", () => {
    expect(switchVariant({ ...step, memory: "10240" }, dynasd, "gpu").memory).toBe("14336");
    expect(switchVariant({ ...step, memory: "16384" }, dynasd, "gpu").memory).toBe("16384");
    // None set: the variant's, so the card shows it.
    expect(switchVariant({ ...step, cpu: "", memory: "" }, dynasd, "gpu")).toMatchObject({ cpu: "4096", memory: "14336" });
  });

  it("keeps a compute type the variant runs on", () => {
    const both = JSON.parse(JSON.stringify(dynasd));
    both.versions[1].variants[1].manifest.runtime.computeTypes = ["standard", "gpu"];
    expect(switchVariant(step, both, "gpu").computeType).toBe("standard");
  });

  it("keeps values the step set, and says when they differ from the variant's default", () => {
    const s = switchVariant({ ...step, defaultParams: { MODEL: "lindda", DEVICE: "auto" } }, dynasd, "gpu");
    expect(s.kept).toEqual([{ name: "MODEL", label: "Detector", value: "lindda", variantDefault: "oncet" }]);
  });

  it("reports ports that differ between variants (bad data)", () => {
    const odd = JSON.parse(JSON.stringify(dynasd));
    odd.versions[1].variants[1].manifest.outputs = [{ name: "events", mediaTypes: ["text/csv"] }];
    expect(switchVariant(step, odd, "gpu").portLines).toEqual(["Output added: events", "Output removed: onsets"]);
  });
});

describe("version changes and GPUs", () => {
  it("falls back to the default when the new version lacks the variant", () => {
    expect(variantFallback(dynasd, "v0.3.0", "v0.2.2", "gpu")).toBe("v0.2.2 has no GPU (ONCET) variant; using the default");
    expect(variantFallback(dynasd, "v0.3.0", "v0.3.0", "gpu")).toBe("");
    expect(variantFallback(dynasd, "v0.3.0", "v0.2.2", "")).toBe("");
  });

  it("disables GPU variants only where no compute node has GPUs", () => {
    const [cpuV, gpuV] = switchableVariants(dynasd, "v0.3.0");
    expect(variantUnavailable(gpuV, { gpus: false })).toBe("No compute node here has GPUs");
    expect(variantUnavailable(gpuV, { gpus: true })).toBe("");
    expect(variantUnavailable(cpuV, { gpus: false })).toBe("");
    expect(nodesHaveGpus([])).toBe(true);
    expect(nodesHaveGpus([{ maxGpuInstances: 0 }])).toBe(false);
    expect(nodesHaveGpus([{ maxGpuInstances: 0 }, { maxGpuInstances: 2 }])).toBe(true);
  });
});
