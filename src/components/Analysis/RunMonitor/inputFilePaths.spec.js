import { describe, it, expect } from "vitest";
import { filePathsOf, filePathsField, sharedNames, FILE_PATHS_SELECTION, FILE_PATHS_SOURCE } from "./inputFilePaths";

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
