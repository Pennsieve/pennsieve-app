import { describe, it, expect } from "vitest";
import { releaseProgress, variantDetails, variantTagWarning, versionVariants } from "./versionVariants";

const manifest = (variant, runtime, model) => ({
  name: "DynaSD",
  runtime: { cpu: 4096, timeoutSeconds: 14400, ...runtime },
  parameters: [{ name: "MODEL", label: "Detector", defaultValue: model }, { name: "DEVICE", defaultValue: "auto" }],
  inputs: [],
  outputs: [],
  ...(variant && { variant }),
});
const app = (variants, status = "deployed") => ({
  versions: [
    { version: "v0.2.2", createdAt: "2026-10-01", status: "deployed", manifest: manifest(null, { memory: 8192 }, "lindda") },
    {
      version: "v0.3.0",
      createdAt: "2026-10-29",
      status,
      manifest: manifest({ id: "cpu", name: "CPU" }, { memory: 8192, computeTypes: ["standard"] }, "lindda"),
      ...(variants && { defaultVariant: "cpu", variants }),
    },
  ],
});
const variants = (gpuStatus, reason = "") => [
  { id: "cpu", name: "CPU", default: true, status: "deployed", manifest: manifest({ id: "cpu" }, { memory: 8192, computeTypes: ["standard"] }, "lindda") },
  {
    id: "gpu",
    name: "GPU (ONCET)",
    description: "CUDA PyTorch",
    default: false,
    status: gpuStatus,
    failureReason: reason,
    manifest: manifest({ id: "gpu" }, { memory: 14336, computeTypes: ["gpu"] }, "oncet"),
  },
];

describe("a version's variants on the app's page", () => {
  it("lists each variant's build, none for a version without", () => {
    const a = app(variants("error", "target cuda not found"));
    expect(versionVariants(a, "v0.3.0").map((v) => [v.id, v.status, v.failureReason])).toEqual([
      ["cpu", "deployed", ""],
      ["gpu", "error", "target cuda not found"],
    ]);
    expect(versionVariants(a, "v0.2.2")).toEqual([]);
  });

  it("says what each variant is and runs with", () => {
    const [cpu, gpu] = variantDetails(app(variants("deployed")), "v0.3.0");
    expect(cpu).toMatchObject({ id: "cpu", default: true, runsOn: "Standard · 4 vCPU · 8 GB", timeout: "4 h", params: [{ name: "MODEL", label: "Detector", value: "lindda" }] });
    expect(gpu).toMatchObject({ id: "gpu", gpu: true, description: "CUDA PyTorch", params: [{ value: "oncet" }] });
    expect(gpu.runsOn).toContain("14 GB");
    expect(variantDetails(app(null), "v0.3.0")).toEqual([]);
  });
});

describe("a release's progress", () => {
  it("waits for the version, then for each variant's build", () => {
    expect(releaseProgress(app(null), "v0.4.0")).toBeNull();
    const building = releaseProgress(app(variants("registering"), "registering"), "0.3.0");
    expect(building).toMatchObject({ tag: "v0.3.0", variants: true, done: false });
    expect(building.rows.map((r) => [r.name, r.status])).toEqual([
      ["CPU", "deployed"],
      ["GPU (ONCET)", "registering"],
    ]);
    expect(releaseProgress(app(variants("error", "x")), "v0.3.0").done).toBe(true);
  });

  it("is the version's own build without variants", () => {
    expect(releaseProgress(app(null), "v0.3.0")).toMatchObject({ variants: false, done: true, rows: [{ name: "v0.3.0", status: "deployed" }] });
  });

  it("warns about -- in a tag of an app with variants", () => {
    expect(variantTagWarning("v1.0.0--rc", true)).toMatch(/can't contain "--"/);
    expect(variantTagWarning("v1.0.0--rc", false)).toBe("");
    expect(variantTagWarning("v1.0.0-rc.1", true)).toBe("");
  });
});
