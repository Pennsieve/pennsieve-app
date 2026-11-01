import { describe, it, expect } from "vitest";
import {
  referenceLabel,
  referenceDetails,
  referenceInputs,
  offeredOrganisms,
  catalogQuery,
  fitsInput,
  isAppDefault,
  appDefault,
  sortReferences,
  referenceSource,
  isReferenceSource,
  formatSize,
  referenceKindText,
  referenceTargetIn,
  runReferences,
} from "./referenceSources";

// Catalog entries as environments-service's /catalog returns them.
const entry = (id, taxonomyId, organism, assembly, version) => ({
  id,
  description: `${organism} salmon index`,
  license: "LicenseRef-GENCODE",
  latestVersion: 1,
  version: {
    version: 1,
    spec: { organism, taxonomyId, assembly, annotation: { provider: "GENCODE", version }, assetClass: "salmon-index", tool: "salmon", toolVersion: "2.8.0" },
    archive: { sha256: "ab12", sizeBytes: 2100000000, unpackedBytes: 2600000000 },
  },
});
const human = entry("h", 9606, "Homo sapiens", "GCA_000001405.29", "50");
const mouse = entry("m", 10090, "Mus musculus", "GCA_000001635.9", "M39");
const zebrafish = entry("z", 7955, "Danio rerio", "GCA_000002035.4", "113");

// rnaseq-quant's index input.
const index = {
  kind: "genome",
  assetClass: "salmon-index",
  toolVersion: ">=2 <3",
  choice: "user",
  organisms: [9606, 10090],
  default: { taxonomyId: 9606, assembly: "GCA_000001405.29", annotation: { provider: "GENCODE", version: "50" } },
};

describe("reference sources", () => {
  it("names a reference in a few words", () => {
    expect(referenceLabel(human)).toBe("Human · GRCh38 · GENCODE 50");
    expect(referenceLabel(mouse)).toBe("Mouse · GRCm39 · GENCODE M39");
    // An organism without a common name keeps its scientific one, an
    // unknown assembly its accession; an app.yml identity reads the same.
    expect(referenceLabel(zebrafish)).toBe("Danio rerio · GCA_000002035.4 · GENCODE 113");
    expect(referenceLabel(index.default)).toBe("Human · GRCh38 · GENCODE 50");
  });

  it("lists an entry's facts for the details pane", () => {
    const d = referenceDetails(human);
    expect(d.organism).toBe("Homo sapiens (9606)");
    expect(d.assembly).toBe("GRCh38 · GCA_000001405.29");
    expect(d.tool).toBe("salmon 2.8.0");
    expect(d.sizeBytes).toBe(2100000000);
    expect(d.version).toBe(1);
  });

  it("finds the inputs filled from the catalog", () => {
    expect(referenceInputs([{ name: "reads" }, { name: "index", reference: index }]).map((p) => p.name)).toEqual(["index"]);
  });

  it("says what an input takes", () => {
    expect(referenceKindText(index)).toBe("Salmon indexes that salmon >=2 <3 can read");
    expect(referenceKindText({ assetClass: "star-index" })).toBe("star-index");
  });

  it("asks the catalog by kind, asset class and tool versions", () => {
    expect(catalogQuery(index)).toEqual({ kind: "genome", assetClass: "salmon-index", toolVersion: ">=2 <3" });
  });

  it("keeps the organisms the input offers", () => {
    expect(offeredOrganisms(index)).toEqual([9606, 10090]);
    expect(fitsInput(human, index)).toBe(true);
    expect(fitsInput(mouse, index)).toBe(true);
    expect(fitsInput(zebrafish, index)).toBe(false);
    // No list: any organism.
    expect(fitsInput(zebrafish, { ...index, organisms: undefined })).toBe(true);
    // A pinned reference fits only itself.
    const pinned = { ...index, choice: "app", ...index.default };
    expect(offeredOrganisms(pinned)).toEqual([9606]);
    expect(fitsInput(human, pinned)).toBe(true);
    expect(fitsInput(mouse, pinned)).toBe(false);
  });

  it("knows the app's default and lists it first", () => {
    expect(isAppDefault(human, index)).toBe(true);
    expect(isAppDefault(mouse, index)).toBe(false);
    expect(appDefault([mouse, human], index)).toBe(human);
    expect(appDefault([mouse], index)).toBe(null);
    expect(sortReferences([mouse, zebrafish, human], index).map((e) => e.id)).toEqual(["h", "z", "m"]);
  });

  it("finds the reference input a source fills", () => {
    const dag = [
      { id: "reads", type: "data-source" },
      { id: "genome", type: "data-source" },
      { id: "quant", type: "processor", inputs: [{ from: "reads", input: "reads" }, { from: "genome", input: "index" }] },
    ];
    const portsOf = (id) => (id === "quant" ? { inputs: [{ name: "reads" }, { name: "index", reference: index }] } : null);
    expect(referenceTargetIn("genome", dag, portsOf)).toEqual({ step: "quant", input: "index", reference: index });
    expect(referenceTargetIn("reads", dag, portsOf)).toBe(null);
    // Ports not known yet: not a reference source (yet).
    expect(referenceTargetIn("genome", dag, () => null)).toBe(null);
  });

  it("lists the references a run used", () => {
    const dag = [{ id: "quant", references: [{ path: "index", source: "", environmentId: "h", version: 1, label: "Human" }] }, { id: "reads" }];
    expect(runReferences(dag)).toEqual([{ step: "quant", path: "index", source: "", environmentId: "h", version: 1, label: "Human" }]);
  });

  it("binds a run's input", () => {
    expect(referenceSource("m")).toEqual({ kind: "reference", environmentId: "m" });
    expect(isReferenceSource(referenceSource("m"))).toBe(true);
    expect(isReferenceSource({ packageIds: [] })).toBe(false);
  });

  it("formats sizes", () => {
    expect(formatSize(2100000000)).toBe("2.1 GB");
    expect(formatSize(383604297)).toBe("384 MB");
    expect(formatSize(0)).toBe("");
  });
});
