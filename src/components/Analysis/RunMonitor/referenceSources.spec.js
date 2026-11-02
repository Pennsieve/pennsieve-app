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
  defaultIdentity,
  choiceLabel,
  createReferenceCatalog,
  inputTakes,
  appsUsing,
  referenceSnippet,
  assetClassName,
} from "./referenceSources";
import { ref } from "vue";

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

// A template: found by its properties, named by its title.
describe("template references", () => {
  const mni = (resolution) => ({
    id: `mni-${resolution}`,
    version: {
      version: 1,
      spec: {
        assetClass: "brain-template",
        title: `MNI152NLin2009cAsym, ${resolution} mm, brain`,
        properties: { space: "MNI152NLin2009cAsym", resolution, desc: "brain" },
      },
      archive: { sha256: "cc", sizeBytes: 9000000, unpackedBytes: 9000000 },
    },
  });
  const pinned = { kind: "template", assetClass: "brain-template", choice: "app", properties: { space: "MNI152NLin2009cAsym", resolution: "1" } };

  it("is named by its title, else its properties", () => {
    expect(referenceLabel(mni("1"))).toBe("MNI152NLin2009cAsym, 1 mm, brain");
    expect(referenceLabel(pinned)).toBe("MNI152NLin2009cAsym · 1");
    expect(referenceDetails(mni("2")).properties).toEqual([
      { name: "space", value: "MNI152NLin2009cAsym" },
      { name: "resolution", value: "2" },
      { name: "desc", value: "brain" },
    ]);
  });

  it("asks the catalog for its kind and properties", () => {
    expect(catalogQuery(pinned)).toEqual({
      kind: "template",
      assetClass: "brain-template",
      "property.space": "MNI152NLin2009cAsym",
      "property.resolution": "1",
    });
  });

  it("pins by properties", () => {
    expect(fitsInput(mni("1"), pinned)).toBe(true);
    expect(fitsInput(mni("2"), pinned)).toBe(false);
    expect(isAppDefault(mni("1"), pinned)).toBe(true);
    // choice user (unset), no organisms: any match fits.
    expect(fitsInput(mni("2"), { kind: "template", assetClass: "brain-template" })).toBe(true);
    expect(referenceKindText(pinned)).toBe("Brain templates");
  });
});

describe("choices and the catalog cache", () => {
  it("labels what a source fills its input with", () => {
    expect(defaultIdentity(index)).toBe(index.default);
    expect(choiceLabel({ reference: index })).toBe("Human · GRCh38 · GENCODE 50");
    expect(choiceLabel({ entry: mouse, reference: index })).toBe("Mouse · GRCm39 · GENCODE M39");
    // Chosen but not loaded yet: not the default's name.
    expect(choiceLabel({ chosenId: "m", reference: index })).toBe("The chosen reference");
    expect(choiceLabel({ reference: { kind: "genome", assetClass: "salmon-index" } })).toBe("The app's default");
  });

  it("matches no entry with an empty default", () => {
    expect(isAppDefault(human, { ...index, default: {} })).toBe(false);
  });

  it("loads each input's candidates once, in parallel", async () => {
    let calls = 0;
    const cat = createReferenceCatalog(async () => {
      calls++;
      return [human, mouse];
    }, ref);
    await Promise.all([cat.ensureLoaded([index, index]), cat.ensureLoaded([index])]);
    expect(calls).toBe(1);
    expect(Object.keys(cat.known.value).sort()).toEqual(["h", "m"]);
    // A failed load is tried again next time.
    const flaky = createReferenceCatalog(async () => {
      calls++;
      throw new Error("down");
    }, ref);
    await flaky.ensureLoaded([index]);
    await flaky.ensureLoaded([index]);
    expect(calls).toBe(3);
  });
});

describe("the reference data page", () => {
  const mni = {
    id: "mni",
    kind: "template",
    version: {
      version: 1,
      spec: {
        assetClass: "brain-template",
        title: "MNI152NLin2009cAsym, 1 mm, brain",
        properties: { space: "MNI152NLin2009cAsym", resolution: "1", desc: "brain" },
      },
      source: { description: "TemplateFlow", files: [{ path: "t1w.nii.gz", url: "https://x/t1w.nii.gz", sha256: "97" }] },
    },
  };
  const template = { kind: "template", assetClass: "brain-template", choice: "app", properties: { space: "MNI152NLin2009cAsym", resolution: "1" } };
  const app = (name, inputs) => ({ name, manifest: { inputs } });
  const manifestOf = (a) => a.manifest;

  it("matches inputs by kind, asset class, properties and organisms", () => {
    expect(inputTakes(template, mni)).toBe(true);
    expect(inputTakes({ ...template, properties: { resolution: "2" } }, mni)).toBe(false);
    expect(inputTakes({ ...template, kind: "genome" }, mni)).toBe(false);
    expect(inputTakes(index, human)).toBe(true);
    expect(inputTakes(index, zebrafish)).toBe(false);
    expect(inputTakes(index, mni)).toBe(false);
    expect(inputTakes(undefined, mni)).toBe(false);
  });

  it("lists the apps that use an entry", () => {
    const apps = [
      app("ants-mni", [{ name: "image" }, { name: "template", reference: template }]),
      app("quant", [{ name: "index", reference: index }]),
      app("plain", [{ name: "data" }]),
      { name: "no manifest" },
    ];
    expect(appsUsing(mni, apps, manifestOf).map((u) => [u.app.name, u.input, u.pinned])).toEqual([["ants-mni", "template", true]]);
    expect(appsUsing(mouse, apps, manifestOf).map((u) => [u.app.name, u.input, u.pinned])).toEqual([["quant", "index", false]]);
  });

  it("writes the app.yml input that pins an entry", () => {
    expect(referenceSnippet(mni)).toBe(
      [
        "- name: reference",
        '  description: "MNI152NLin2009cAsym, 1 mm, brain"',
        "  placement: subfolder",
        "  reference:",
        "    kind: template",
        "    assetClass: brain-template",
        "    choice: app",
        '    properties: {space: "MNI152NLin2009cAsym", resolution: "1", desc: "brain"}',
      ].join("\n")
    );
    const genome = referenceSnippet({ ...human, kind: "genome" });
    expect(genome).toContain('toolVersion: ">=2 <3"');
    expect(genome).toContain("taxonomyId: 9606");
    expect(genome).toContain('annotation: {provider: "GENCODE", version: "50"}');
    // A pinned snippet matches the entry it came from.
    expect(inputTakes({ kind: "template", assetClass: "brain-template", choice: "app", properties: mni.version.spec.properties }, mni)).toBe(true);
  });

  it("names asset classes and shows sources", () => {
    expect(assetClassName("brain-template")).toBe("Brain templates");
    expect(assetClassName("bowtie2-index")).toBe("bowtie2-index");
    expect(referenceDetails(mni).source.files[0].path).toBe("t1w.nii.gz");
    expect(referenceDetails(human).source).toEqual({ description: "", files: [] });
  });
});
