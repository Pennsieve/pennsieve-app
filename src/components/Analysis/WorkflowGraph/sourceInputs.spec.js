import { describe, it, expect } from "vitest";
import { inputsFedBy, sourceLabel, sourceHints, hintLine, portsOfStep, missingFilesMessage, fileShortType, fileTypeMismatches, acceptedFileTypes, linkHints } from "./sourceInputs";

// Four sources into test-ports-processor: two linked to its inputs, two to
// "all inputs".
const steps = [
  { id: "s1", inputs: [] },
  {
    id: "b",
    dependsOn: ["s1", "s2", "s3", "s4"],
    inputs: [
      { from: "s1", input: "signals" },
      { from: "s2", input: "events" },
    ],
  },
  { id: "c", inputs: [{ from: "s2", input: "events" }, { from: "s2", input: "study" }] },
];
const ports = {
  b: { inputs: [{ name: "signals", mediaTypes: ["text/csv"] }, { name: "events", mediaTypes: ["application/json"] }] },
  c: { inputs: [{ name: "events", mediaTypes: ["application/json"] }, { name: "study", conformsTo: ["pennsieve-published-dataset", "bids@1.9"] }] },
};

describe("data sources named after their inputs", () => {
  it("finds the inputs a source feeds", () => {
    expect(inputsFedBy("s1", steps)).toEqual([{ step: "b", input: "signals" }]);
    expect(inputsFedBy("s3", steps)).toEqual([]);
  });

  it("names a source after them, each once, else plainly", () => {
    expect(sourceLabel("s1", steps)).toBe("signals");
    expect(sourceLabel("s2", steps)).toBe("events, study");
    expect(sourceLabel("s3", steps)).toBe("Input data");
    expect(sourceLabel("s3", steps, "Data Source")).toBe("Data Source");
    expect(sourceLabel("s1", undefined)).toBe("Input data");
  });

  it("says what those inputs take", () => {
    const hints = sourceHints("s2", steps, (id) => ports[id]);
    expect(hints.map((h) => [h.input, h.types.join(","), h.layout])).toEqual([
      ["events", "JSON", ""],
      ["events", "JSON", ""],
      ["study", "", "BIDS"],
    ]);
    expect(hintLine(sourceHints("s1", steps, (id) => ports[id]))).toBe("signals takes CSV files");
    expect(hintLine([{ input: "study", types: [], layout: "BIDS" }])).toBe("study takes a BIDS folder");
    expect(hintLine(hints)).toBe("events takes JSON files; study takes a BIDS folder");
    // An app without an app.yml: nothing to say.
    expect(sourceHints("s1", steps, () => null)).toEqual([]);
  });

  it("finds a run step's ports from the app list, at its version", () => {
    const apps = [{ sourceUrl: "https://github.com/Pennsieve/test-ports-processor", versions: [
      { version: "v1.0.0", createdAt: "2026-10-26", manifest: ports.b },
    ] }];
    const dag = [{ id: "b", sourceUrl: "https://github.com/Pennsieve/test-ports-processor.git", tag: "v1.0.0" }];
    expect(portsOfStep(dag, apps)("b")).toEqual(ports.b);
    expect(portsOfStep(dag, apps)("nope")).toBeNull();
  });

  it("names the inputs still without files", () => {
    expect(missingFilesMessage(["s1", "s2"], steps)).toBe("Select files for signals and events, study");
    expect(missingFilesMessage(["s1"], steps)).toBe("Select files for signals");
    expect(missingFilesMessage(["s3"], steps)).toBe("Select files for data source");
    expect(missingFilesMessage(["s1", "s3"], steps)).toBe("Select files for 2 data sources");
  });
});


describe("file types against an input", () => {
  it("names a file's type by its extension", () => {
    expect(fileShortType("a.csv")).toBe("CSV");
    expect(fileShortType("scan.nii.gz")).toBe("NIFTI");
    expect(fileShortType("x.JSON")).toBe("JSON");
    expect(fileShortType("README")).toBe("");
  });

  it("finds the files an input doesn't take", () => {
    const json = [{ input: "events", types: ["JSON"], layout: "" }];
    expect(fileTypeMismatches(["e.json", "s.csv"], json)).toEqual({ names: ["s.csv"], expected: "JSON" });
    expect(fileTypeMismatches(["e.json"], json)).toBeNull();
  });

  it("has nothing to say when an input takes any file, a folder, or declares nothing", () => {
    expect(fileTypeMismatches(["s.csv"], [{ input: "x", types: ["Any"], layout: "" }])).toBeNull();
    expect(fileTypeMismatches(["s.csv"], [{ input: "x", types: [], layout: "BIDS" }])).toBeNull();
    expect(fileTypeMismatches(["s.csv"], [])).toBeNull();
  });

  it("takes what any of the inputs it feeds takes", () => {
    const two = [
      { input: "a", types: ["CSV"], layout: "" },
      { input: "b", types: ["JSON"], layout: "" },
    ];
    expect(fileTypeMismatches(["s.csv", "e.json", "x.edf"], two)).toEqual({ names: ["x.edf"], expected: "CSV or JSON" });
  });
});

describe("linkHints", () => {
  it("keeps the hints for one link", () => {
    const hints = [
      { step: "a", input: "signals", types: ["CSV"] },
      { step: "a", input: "events", types: ["JSON"] },
      { step: "b", input: "signals", types: ["CSV"] },
    ];
    expect(linkHints(hints, "a", "events").map((h) => h.types[0])).toEqual(["JSON"]);
    expect(linkHints(hints, "a").length).toBe(2);
  });
});

describe("acceptedFileTypes", () => {
  it("is what a source's inputs take, or null when any file will do", () => {
    expect([...acceptedFileTypes([{ types: ["CSV"] }, { types: ["JSON", "CSV"] }])]).toEqual(["CSV", "JSON"]);
    expect(acceptedFileTypes([{ types: ["CSV"] }, { types: [] }])).toBeNull();
    expect(acceptedFileTypes([{ types: ["CSV"], layout: "BIDS" }])).toBeNull();
    expect(acceptedFileTypes([{ types: ["Any"] }])).toBeNull();
    expect(acceptedFileTypes([])).toBeNull();
  });
});
