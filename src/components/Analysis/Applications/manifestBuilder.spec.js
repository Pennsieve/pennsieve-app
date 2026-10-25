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
} from "./manifestBuilder";

describe("what kind of app", () => {
  it("a notebook writes a Jupyter session, no parameters, and any-files ports; switching back loses nothing", () => {
    const schema = createApplicationSchema({ parameters: [createParameter({ name: "threshold" })] });
    expect(appKind(schema)).toBe("batch");

    setAppKind(schema, "notebook", "r");
    expect(appKind(schema)).toBe("notebook");
    const m = buildManifest(manifestSchemaFor(schema), { name: "R notebook" });
    expect(m.runtime).toMatchObject({ interactive: true, sessionType: "jupyter", kernel: "r" });
    expect(m).not.toHaveProperty("parameters");
    expect(m.inputs).toEqual([{ name: "files", description: "Files to open in the notebook, staged under input/" }]);
    expect(m.outputs).toEqual([{ name: "files", description: "What the notebook writes under output/" }]);
    expect(validateManifestDoc(m).valid).toBe(true);

    setAppKind(schema, "batch");
    const back = buildManifest(manifestSchemaFor(schema), { name: "a" });
    expect(back.runtime).not.toHaveProperty("interactive");
    expect(back.parameters.map((p) => p.name)).toEqual(["threshold"]);
    // The notebook's ports stay: they're values the author has now.
    expect(back.inputs[0].name).toBe("files");
  });

  it("keeps a notebook's own ports, and defaults its kernel to Python", () => {
    const schema = createApplicationSchema({ inputs: [{ name: "edf", description: "", dataType: "any", mediaTypes: [], formats: [] }] });
    setAppKind(schema, "notebook");
    expect(schema.runtime.kernel).toBe("python");
    expect(schema.inputs.map((p) => p.name)).toEqual(["edf"]);
    expect(schema.outputs).toEqual([]);
  });

  it("opens an app's app.yml as its kind (loading from an app)", () => {
    const parsed = parseManifestText(
      "application:\n  name: R notebook\nruntime:\n  interactive: true\n  sessionType: jupyter\n  kernel: r\ninputs:\n  - name: files\n"
    );
    expect(parsed.meta.name).toBe("R notebook");
    expect(appKind(parsed.schema)).toBe("notebook");
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

  it("doesn't check a notebook's (unwritten) parameters", () => {
    const schema = createApplicationSchema({ parameters: [createParameter({ name: "" })] });
    setAppKind(schema, "notebook");
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
