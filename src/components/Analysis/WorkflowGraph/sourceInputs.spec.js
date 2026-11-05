import { describe, it, expect } from "vitest";
import { inputsFedBy, sourceLabel, sourceHints, hintLine, portsOfStep, missingFilesMessage, fileShortType, fileShortTypes, fileTypeMismatches, acceptedFileTypes, linkHints, fileMediaTypes } from "./sourceInputs";

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
    // A compressed file is GZIP, and the format inside when it's known.
    expect(fileShortTypes("test_rnaseq_1.fastq.gz")).toEqual(["GZIP", "FASTQ"]);
    expect(fileShortTypes("reads.fq")).toEqual(["FQ", "FASTQ"]);
    expect(fileShortTypes("samples.xlsx")).toEqual(["SHEET"]);
    expect(fileShortTypes("scan.nii.gz")).toEqual(["NIFTI"]);
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

// rnaseq-quant's reads input: gzip, CSV and spreadsheet media types plus the
// FASTQ EDAM format. Its FASTQs, compressed or not, and its sample sheets fit.
describe("an input's media types and EDAM formats", () => {
  const reads = {
    name: "reads",
    mediaTypes: ["application/gzip", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    formats: ["format_1930"],
  };
  const dag = [{ id: "quant", inputs: [{ from: "src", input: "reads" }] }];
  const hints = sourceHints("src", dag, () => ({ inputs: [reads] }));

  it("names them all", () => {
    expect(hints[0].types).toEqual(["GZIP", "CSV", "SHEET", "FASTQ"]);
  });

  it("takes FASTQs and sample sheets", () => {
    expect(fileTypeMismatches(["test_rnaseq_1.fastq.gz", "a_R2.fq.gz", "b.fastq", "samples.csv", "samples.xlsx"], hints)).toBeNull();
    expect(fileTypeMismatches(["notes.pdf"], hints)).toEqual({ names: ["notes.pdf"], expected: "GZIP or CSV or SHEET or FASTQ" });
  });
});

describe("formats sharing a media type (profiles)", () => {
  const formats = [
    { value: "application/x-hdf5", extensions: [".hdf5", ".h5"] },
    { value: "application/x-hdf5; profile=nwb", extensions: [".nwb"] },
    { value: "image/tiff", extensions: [".tiff", ".tif"] },
    { value: "image/tiff; profile=ome-tiff", extensions: [".ome.tiff", ".ome.tif"] },
  ];
  const hintsFor = (mediaTypes) =>
    sourceHints("src", [{ id: "s", inputs: [{ from: "src", input: "x" }] }], () => ({ inputs: [{ name: "x", mediaTypes }] }));

  it("types a file by its longest extension", () => {
    expect(fileMediaTypes("a.nwb", formats)).toEqual(["application/x-hdf5; profile=nwb"]);
    expect(fileMediaTypes("cells.OME.TIF", formats)).toEqual(["image/tiff; profile=ome-tiff"]);
    expect(fileMediaTypes("plain.tif", formats)).toEqual(["image/tiff"]);
    expect(fileMediaTypes("notes.pdf", formats)).toEqual([]);
  });

  it("an HDF5 input takes NWB files; an NWB input not plain HDF5", () => {
    expect(fileTypeMismatches(["a.h5", "b.nwb"], hintsFor(["application/x-hdf5"]), formats)).toBeNull();
    expect(fileTypeMismatches(["a.h5", "b.nwb"], hintsFor(["application/x-hdf5; profile=nwb"]), formats)).toEqual({ names: ["a.h5"], expected: "NWB" });
  });

  it("an OME-TIFF input names and takes OME-TIFFs", () => {
    const hints = hintsFor(["image/tiff; profile=ome-tiff"]);
    expect(hints[0].types).toEqual(["OME-TIFF"]);
    expect(fileTypeMismatches(["x.ome.tiff", "y.tif"], hints)).toEqual({ names: ["y.tif"], expected: "OME-TIFF" });
  });
});
