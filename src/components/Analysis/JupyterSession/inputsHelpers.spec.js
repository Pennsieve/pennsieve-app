import { describe, it, expect } from "vitest";
import {
  folderContents,
  filesUnder,
  inputKey,
  middleTruncate,
  pendingFiles,
  rowStatus,
  summarize,
} from "./inputsHelpers";

const entries = [
  { cratePath: "files/sub/c.csv", size: 30 },
  { cratePath: "files/a.csv", size: 10 },
  { cratePath: "files/sub/b.csv", size: 20 },
  { cratePath: "README.md", size: 5 },
];

describe("folderContents", () => {
  it("lists folders first, with the files below them, then files", () => {
    expect(folderContents(entries, "").map((r) => [r.type, r.name, r.count, r.size])).toEqual([
      ["folder", "files", 3, 60],
      ["file", "README.md", undefined, 5],
    ]);
    expect(folderContents(entries, "files/").map((r) => [r.type, r.path])).toEqual([
      ["folder", "files/sub/"],
      ["file", "files/a.csv"],
    ]);
  });
});

describe("filesUnder", () => {
  it("is every file below a folder, or the one file", () => {
    expect(filesUnder(entries, "files/sub/").map((e) => e.cratePath)).toEqual([
      "files/sub/c.csv",
      "files/sub/b.csv",
    ]);
    expect(filesUnder(entries, "files/a.csv")).toHaveLength(1);
    // A folder path doesn't match a file whose name only starts the same.
    expect(filesUnder([{ cratePath: "files/subway.csv" }], "files/sub/")).toEqual([]);
  });
});

describe("summarize and rowStatus", () => {
  const states = {
    "files/sub/c.csv": { state: "done" },
    "files/sub/b.csv": { state: "downloading", bytes: 5, size: 20 },
  };
  const stateOf = (e) => states[e.cratePath];

  it("counts progress", () => {
    const s = summarize(filesUnder(entries, "files/sub/"), stateOf);
    expect(s).toMatchObject({ total: 2, done: 1, active: 1, bytes: 5, size: 20 });
    expect(rowStatus(s)).toEqual({ cls: "active", text: "25%" });
  });

  it("shows failures first, then done", () => {
    expect(rowStatus({ total: 2, done: 1, failed: 1, active: 0 }).cls).toBe("failed");
    expect(rowStatus({ total: 2, done: 2, failed: 0, active: 0 }).cls).toBe("done");
    expect(rowStatus({ total: 2, done: 1, failed: 0, active: 0 }).text).toBe("1/2");
    expect(rowStatus({ total: 2, done: 0, failed: 0, active: 0 })).toBeNull();
  });
});

describe("pendingFiles", () => {
  const sources = [{ nodeId: "node_input", entries }];

  it("expands folders and leaves out files already asked for", () => {
    const selected = new Set([inputKey("node_input", "files/"), inputKey("node_input", "files/a.csv")]);
    const states = {
      [inputKey("node_input", "files/sub/c.csv")]: { state: "done" },
      [inputKey("node_input", "files/sub/b.csv")]: { state: "failed" },
    };
    expect(pendingFiles(sources, selected, states)).toEqual([
      { source: "node_input", path: "files/a.csv", size: 10 },
      { source: "node_input", path: "files/sub/b.csv", size: 20 },
    ]);
  });

  it("ignores another source's selection", () => {
    expect(pendingFiles(sources, new Set([inputKey("other", "files/")]), {})).toEqual([]);
  });
});

describe("middleTruncate", () => {
  it("keeps both ends of a long name", () => {
    const name = "H2192cG1a_Hu_NOS_ChAT_5-HT_1st_layer.tif";
    const short = middleTruncate(name, 24);
    expect(short).toHaveLength(24);
    expect(short.startsWith("H2192cG1a")).toBe(true);
    expect(short.endsWith("layer.tif")).toBe(true);
    expect(middleTruncate("short.csv", 24)).toBe("short.csv");
  });
});
