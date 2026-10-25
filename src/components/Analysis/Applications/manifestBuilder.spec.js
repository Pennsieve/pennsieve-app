import { describe, it, expect } from "vitest";
import { createApplicationSchema, createParameter, buildManifest } from "./applicationSchema";
import { parseManifestText } from "@/composables/useAppManifest";
import { validateManifestDoc } from "./manifestValidation";
import {
  appKind,
  setAppKind,
  manifestSchemaFor,
  sectionOfPath,
  fieldKeyOfPath,
  builderChecks,
  problemsBySection,
  problemsByField,
  EDAM_FORMATS,
  edamLabel,
  edamOptions,
  normalizeFormatPick,
  previewApp,
  prefillFromApp,
  repoOf,
  maintainerFromProfile,
} from "./manifestBuilder";

describe("what kind of app", () => {
  it("an interactive app writes a live session, no parameters, and any-files ports; switching back loses nothing", () => {
    const schema = createApplicationSchema({ parameters: [createParameter({ name: "threshold" })] });
    expect(appKind(schema)).toBe("batch");

    setAppKind(schema, "interactive");
    expect(appKind(schema)).toBe("interactive");
    // Jupyter is the session type the platform runs; its language defaults to Python.
    expect(schema.runtime).toMatchObject({ sessionType: "jupyter", kernel: "python" });
    schema.runtime.kernel = "r";
    const m = buildManifest(manifestSchemaFor(schema), { name: "R notebook" });
    expect(m.runtime).toMatchObject({ interactive: true, sessionType: "jupyter", kernel: "r" });
    expect(m).not.toHaveProperty("parameters");
    expect(m.inputs).toEqual([{ name: "files", description: "Files to open in the session, staged under input/" }]);
    expect(m.outputs).toEqual([{ name: "files", description: "What the session writes under output/" }]);
    expect(validateManifestDoc(m).valid).toBe(true);

    setAppKind(schema, "batch");
    const back = buildManifest(manifestSchemaFor(schema), { name: "a" });
    expect(back.runtime).not.toHaveProperty("interactive");
    expect(back.parameters.map((p) => p.name)).toEqual(["threshold"]);
    // The session's ports stay: they're values the author has now.
    expect(back.inputs[0].name).toBe("files");
  });

  it("keeps an interactive app's own ports, and defaults its kernel to Python", () => {
    const schema = createApplicationSchema({ inputs: [{ name: "edf", description: "", dataType: "any", mediaTypes: [], formats: [] }] });
    setAppKind(schema, "interactive");
    expect(schema.runtime.kernel).toBe("python");
    expect(schema.inputs.map((p) => p.name)).toEqual(["edf"]);
    expect(schema.outputs).toEqual([]);
  });

  it("opens an app's app.yml as its kind (loading from an app)", () => {
    const parsed = parseManifestText(
      "application:\n  name: R notebook\nruntime:\n  interactive: true\n  sessionType: jupyter\n  kernel: r\ninputs:\n  - name: files\n"
    );
    expect(parsed.meta.name).toBe("R notebook");
    expect(appKind(parsed.schema)).toBe("interactive");
    expect(parsed.schema.runtime.kernel).toBe("r");
    expect(appKind(parseManifestText("application:\n  name: a\nruntime:\n  computeTypes: [standard]\n").schema)).toBe("batch");
  });
});

describe("sections and fields", () => {
  it("puts each problem in its section", () => {
    expect(sectionOfPath("application.name")).toBe("about");
    expect(sectionOfPath("application.tags.0")).toBe("about");
    expect(sectionOfPath("runtime.kernel")).toBe("about"); // the kind heads About
    expect(sectionOfPath("runtime")).toBe("about");
    expect(sectionOfPath("inputs.0.formats.1")).toBe("does");
    expect(sectionOfPath("parameters.2.name")).toBe("does");
    expect(sectionOfPath("runtime.cpu")).toBe("runs");
    expect(sectionOfPath("application.maintainers.0.orcid")).toBe("people");
    expect(sectionOfPath("Line 3")).toBe("about");
  });

  it("maps a problem's path to the field the form marks", () => {
    expect(fieldKeyOfPath("application")).toBe("application.name");
    expect(fieldKeyOfPath("application.tags.2")).toBe("application.tags");
    expect(fieldKeyOfPath("application.maintainers.1.orcid")).toBe("application.maintainers.1");
    expect(fieldKeyOfPath("inputs.0.formats.1")).toBe("inputs.0.formats");
    expect(fieldKeyOfPath("inputs.0")).toBe("inputs.0");
    expect(fieldKeyOfPath("parameters.0.validValues.3")).toBe("parameters.0.validValues");
    expect(fieldKeyOfPath("runtime.computeTypes.1")).toBe("runtime.computeTypes");
    expect(fieldKeyOfPath("runtime.kernel")).toBe("kind");
    expect(fieldKeyOfPath("Root")).toBeNull();
    expect(fieldKeyOfPath("Line 4")).toBeNull();
  });

  it("counts problems per section and lists them per field", () => {
    const schema = createApplicationSchema({
      parameters: [createParameter({ name: "a" }), createParameter({ name: "a" }), createParameter({ name: "" })],
    });
    const checks = builderChecks({ name: "" }, schema);
    expect(checks).toEqual([
      { path: "application.name", message: "is required" },
      { path: "parameters.1.name", message: '"a" is used twice' },
      { path: "parameters.2.name", message: "is missing a name" },
    ]);
    const problems = [...checks, { path: "application.maintainers.0.orcid", message: "must be an ORCID iD" }];
    const by = problemsBySection(problems);
    expect(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length]))).toEqual({ about: 1, does: 2, runs: 0, people: 1 });
    expect(problemsByField(problems)).toEqual({
      "application.name": ["is required"],
      "parameters.1.name": ['"a" is used twice'],
      "parameters.2.name": ["is missing a name"],
      "application.maintainers.0": ["must be an ORCID iD"],
    });
  });

  it("doesn't check an interactive app's (unwritten) parameters", () => {
    const schema = createApplicationSchema({ parameters: [createParameter({ name: "" })] });
    setAppKind(schema, "interactive");
    expect(builderChecks({ name: "n" }, schema)).toEqual([]);
  });
});

describe("EDAM formats", () => {
  it("offers well-formed, distinct ids, labelled", () => {
    const ids = EDAM_FORMATS.map((f) => f.id);
    expect(ids.every((id) => /^format_\d{4}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(edamLabel("format_3590")).toBe("HDF5 (format_3590)");
    expect(edamLabel("format_9999")).toBe("format_9999");
    expect(edamOptions(["format_9999"]).at(-1)).toEqual({ value: "format_9999", label: "format_9999" });
  });

  it("keeps an id whether picked, typed as a URI, or typed as a label", () => {
    expect(normalizeFormatPick("format_3590")).toBe("format_3590");
    expect(normalizeFormatPick("http://edamontology.org/format_3752")).toBe("format_3752");
    expect(normalizeFormatPick("hdf5")).toBe("format_3590");
  });
});

describe("the card preview", () => {
  it("reads the app.yml as the Gallery reads a version's manifest", () => {
    const m = buildManifest(createApplicationSchema({ tags: ["eeg"] }), { name: "Spikes", description: "Finds spikes" });
    const app = previewApp(m);
    expect(app.name).toBe("Spikes");
    expect(app.versions[0].manifest).toMatchObject({ name: "Spikes", description: "Finds spikes", tags: ["eeg"] });
  });
});

describe("prefillFromApp", () => {
  const profile = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", orcid: { orcid: "https://orcid.org/0000-0002-1825-0097" } };

  it("opens the repository's app.yml when it has one", () => {
    const app = {
      sourceUrl: "https://github.com/org/spike-detect",
      assets: { "app.yml": "application:\n  name: Spike detect\n  tags: [eeg]\nruntime:\n  cpu: 2048\n" },
    };
    const { meta, schema, fromManifest } = prefillFromApp(app, profile);
    expect(fromManifest).toBe(true);
    expect(meta.name).toBe("Spike detect");
    expect(meta.maintainers).toEqual([]);
    expect(schema.resources.cpu).toBe(2048);
  });

  it("starts from the repository, its parameters and the user when there's none", () => {
    const app = {
      sourceUrl: "https://github.com/org/spike-detect.git",
      assets: { "README.md": "# hi" },
      params: [
        { name: "THRESHOLD", type: "number", defaultValue: "0.5", required: false },
        { name: "MODE", validValues: ["fast", "slow"], required: true },
        { name: "" },
      ],
    };
    const { meta, schema, fromManifest } = prefillFromApp(app, profile, { repoDescription: "Finds spikes" });
    expect(fromManifest).toBe(false);
    expect(meta.name).toBe("spike-detect");
    expect(meta.description).toBe("Finds spikes");
    expect(meta.maintainers).toEqual([{ name: "Ada Lovelace", email: "ada@example.org", orcid: "0000-0002-1825-0097" }]);
    expect(schema.parameters.map((p) => p.name)).toEqual(["THRESHOLD", "MODE"]);
    expect(schema.runtime.interactive).toBeFalsy();
  });

  it("copes with missing fields and a broken app.yml", () => {
    const { meta, schema } = prefillFromApp({ assets: { "app.yml": "application: [" } }, {});
    expect(meta.name).toBe("");
    expect(meta.maintainers).toEqual([]);
    expect(schema.parameters).toEqual([]);
    expect(prefillFromApp(null).meta.name).toBe("");
  });

  it("reads owner and repo from a GitHub URL", () => {
    expect(repoOf("https://github.com/Pennsieve/seurat-processor")).toEqual({
      owner: "Pennsieve",
      repo: "seurat-processor",
      fullName: "Pennsieve/seurat-processor",
    });
    expect(repoOf("")).toBeNull();
    expect(maintainerFromProfile({})).toBeNull();
  });
});
