import { describe, it, expect } from "vitest";
import { validateManifestDoc, validateManifestText, problemText, builderProblems } from "./manifestValidation";
import { buildManifest, createApplicationSchema } from "./applicationSchema";

const batch = {
  application: { name: "spike-detect", description: "Finds spikes", tags: ["eeg"], maintainers: [{ name: "Ada", orcid: "0000-0002-1825-0097" }] },
  runtime: { cpu: 1024, memory: 2048, computeTypes: ["standard"] },
  parameters: [{ name: "THRESHOLD", type: "number", defaultValue: 0.5 }],
  inputs: [{ name: "edf", mediaTypes: ["application/octet-stream"], formats: ["format_3998"] }],
  outputs: [{ name: "spikes", mediaTypes: ["text/csv"] }],
};
const jupyter = {
  application: { name: "Jupyter notebook" },
  runtime: { interactive: true, sessionType: "jupyter", kernel: "python", computeTypes: ["standard"] },
  inputs: [{ name: "files" }],
};
const messages = (r) => r.problems.map(problemText);

describe("validateManifestDoc", () => {
  it("accepts a batch app and a Jupyter session", () => {
    expect(validateManifestDoc(batch)).toEqual({ valid: true, problems: [] });
    expect(validateManifestDoc(jupyter).valid).toBe(true);
  });

  it("names unknown fields, missing fields and wrong values", () => {
    const r = validateManifestDoc({
      application: { description: "no name", tag: ["x"] },
      runtime: { sessionType: "rstudio" },
    });
    expect(r.valid).toBe(false);
    expect(messages(r)).toEqual(
      expect.arrayContaining([
        "application.tag: isn't a field app.yml knows: tag",
        "application: is missing name",
        "runtime.sessionType: must be one of jupyter",
      ])
    );
    expect(messages(validateManifestDoc({ application: { name: "a" }, extra: 1 }))).toEqual(["extra: isn't a field app.yml knows: extra"]);
  });

  it("explains patterns by field", () => {
    const r = validateManifestDoc({
      application: { name: "a", maintainers: [{ name: "Ada", orcid: "12345", email: "nope" }] },
      inputs: [{ name: "x", formats: ["edf"], mediaTypes: ["csv"] }],
    });
    expect(messages(r)).toEqual(
      expect.arrayContaining([
        "application.maintainers.0.orcid: must be an ORCID iD, like 0000-0002-1825-0097",
        "application.maintainers.0.email: must be an email address",
        "inputs.0.formats.0: must be an EDAM format id, like format_3998",
        "inputs.0.mediaTypes.0: must be a media type, like text/csv",
      ])
    );
  });

  it("states the session rules in their own words, once each", () => {
    expect(messages(validateManifestDoc({ application: { name: "a" }, runtime: { interactive: true, sessionType: "jupyter" } }))).toEqual([
      "runtime: a Jupyter session needs a kernel: python or r",
    ]);
    expect(messages(validateManifestDoc({ application: { name: "a" }, runtime: { sessionType: "jupyter", kernel: "r" } }))).toEqual([
      "runtime: sessionType only applies to a live session: set interactive: true",
    ]);
    expect(messages(validateManifestDoc({ application: { name: "a" }, runtime: { kernel: "python" } }))).toEqual([
      "runtime: kernel only applies to a Jupyter session: set sessionType: jupyter",
    ]);
  });

  it("names wrong types", () => {
    expect(messages(validateManifestDoc({ application: { name: "a", tags: "eeg" } }))).toEqual(["application.tags: must be a list"]);
  });
});

describe("validateManifestText", () => {
  it("reports YAML syntax errors with their line", () => {
    const r = validateManifestText("application:\n  name: a\n  tags: [x\n");
    expect(r.valid).toBe(false);
    expect(r.problems[0].path).toMatch(/^Line \d+$/);
    expect(r.problems[0].message).toMatch(/^isn't valid YAML:/);
  });

  it("needs a mapping, and something in the file", () => {
    expect(messages(validateManifestText("- a\n- b\n"))[0]).toMatch(/must be a mapping/);
    expect(messages(validateManifestText("   "))).toEqual(["Root: the file is empty"]);
  });

  it("validates the document and hands it back", () => {
    const r = validateManifestText("application:\n  name: a\n");
    expect(r.valid).toBe(true);
    expect(r.doc.application.name).toBe("a");
  });
});

describe("builderProblems", () => {
  it("leaves out what the builder's own checks say, and keeps the rest", () => {
    const schema = createApplicationSchema({ runtime: { computeTypes: ["standard"], interactive: true, sessionType: "jupyter", kernel: "" } });
    const manifest = buildManifest(schema, { name: "", maintainers: [{ name: "Ada", email: "", orcid: "12345" }] });
    const all = validateManifestDoc(manifest).problems.map(problemText);
    const shown = builderProblems(manifest, { nameMissing: true }).map(problemText);
    expect(all.some((m) => /name/.test(m))).toBe(true);
    expect(shown.some((m) => /missing name|application\.name/.test(m))).toBe(false);
    expect(shown).toEqual(expect.arrayContaining(["application.maintainers.0.orcid: must be an ORCID iD, like 0000-0002-1825-0097"]));
  });

  it("is empty for a complete manifest", () => {
    const manifest = buildManifest(createApplicationSchema(), { name: "spike-detect" });
    expect(builderProblems(manifest)).toEqual([]);
  });
});
