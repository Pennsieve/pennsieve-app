import { describe, it, expect } from "vitest";
import { filePathsOf, filePathsField, sharedNames, placementRows, FILE_PATHS_SELECTION, FILE_PATHS_SOURCE } from "./inputFilePaths";

const file = (id, name) => ({ content: { id, name } });

describe("input file paths", () => {
  it("reads a run's choice, selection when it has none", () => {
    expect(filePathsOf({ packageIds: ["a"], filePaths: "source" })).toBe(FILE_PATHS_SOURCE);
    expect(filePathsOf({ packageIds: ["a"], filePaths: "selection" })).toBe(FILE_PATHS_SELECTION);
    expect(filePathsOf({ packageIds: ["a"] })).toBe(FILE_PATHS_SELECTION);
    expect(filePathsOf(undefined)).toBe(FILE_PATHS_SELECTION);
  });

  it("sends the choice only when it isn't the default", () => {
    expect({ packageIds: ["a"], ...filePathsField(FILE_PATHS_SOURCE) }).toEqual({ packageIds: ["a"], filePaths: "source" });
    expect({ packageIds: ["a"], ...filePathsField(FILE_PATHS_SELECTION) }).toEqual({ packageIds: ["a"] });
    expect(filePathsField(undefined)).toEqual({});
  });

  it("finds selected items that would land on the same path", () => {
    const files = [
      file("p1", "electrodes.tsv"),
      file("p2", "electrodes.tsv"),
      file("p3", "run-01.edf"),
      file("c1", "sub-01"),
      file("c2", "sub-01"),
    ];
    expect(sharedNames(files)).toEqual(["electrodes.tsv", "sub-01"]);
  });

  it("doesn't count the same item twice, or items without a name", () => {
    expect(sharedNames([file("p1", "a.tsv"), file("p1", "a.tsv"), { content: {} }, null])).toEqual([]);
    expect(sharedNames(undefined)).toEqual([]);
  });
});

describe("placement rows", () => {
  const items = [
    { name: "electrodes.tsv", path: ["sub-01", "ieeg"] },
    { name: "run-01.edf", path: ["sub-01", "ieeg"] },
    { name: "notes", folder: true, path: [] },
  ];
  const show = (rows) => rows.map((r) => `${"  ".repeat(r.depth)}${r.label}${r.folder ? "/" : ""}`);

  it("as selected, puts each item at the top", () => {
    expect(show(placementRows(FILE_PATHS_SELECTION, items))).toEqual([
      "input/",
      "  electrodes.tsv",
      "  run-01.edf",
      "  notes/",
    ]);
  });

  it("as in the source, keeps the folders they're in, shared ones once", () => {
    expect(show(placementRows(FILE_PATHS_SOURCE, items, 10))).toEqual([
      "input/",
      "  sub-01/",
      "    ieeg/",
      "      electrodes.tsv",
      "      run-01.edf",
      "  notes/",
    ]);
  });

  it("merges a chosen folder with the same folder above other items", () => {
    const rows = placementRows(FILE_PATHS_SOURCE, [
      { name: "sub-01", folder: true, path: [] },
      { name: "a.edf", path: ["sub-01"] },
    ]);
    expect(show(rows)).toEqual(["input/", "  sub-01/", "    a.edf"]);
  });

  it("shows an item whose folders aren't known under …", () => {
    expect(show(placementRows(FILE_PATHS_SOURCE, [{ name: "a.edf", path: null }]))).toEqual(["input/", "  …/", "    a.edf"]);
  });

  it("past max rows, says how many items aren't shown", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.edf`, path: ["sub"] }));
    expect(show(placementRows(FILE_PATHS_SELECTION, many))).toEqual(["input/", "  f0.edf", "  f1.edf", "  f2.edf", "  +4 more"]);
    expect(show(placementRows(FILE_PATHS_SOURCE, many))).toEqual(["input/", "  sub/", "    f0.edf", "    f1.edf", "  +5 more"]);
  });
});
