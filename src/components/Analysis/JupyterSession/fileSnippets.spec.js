import { describe, it, expect } from "vitest";
import { fileKind, fileSnippets } from "./fileSnippets";

describe("fileKind", () => {
  it("reads the longest known extension", () => {
    expect(fileKind("input/a/brain.nii.gz")).toBe("nifti");
    expect(fileKind("input/counts.csv.gz")).toBe("table");
    expect(fileKind("input/run.v2.NWB")).toBe("nwb");
    expect(fileKind("input/sub-01.edf")).toBe("edf");
  });

  it("knows nothing of other files", () => {
    expect(fileKind("input/README")).toBeNull();
    expect(fileKind("input/notes.md")).toBeNull();
  });
});

describe("fileSnippets", () => {
  it("writes the path through INPUT_DIR in Python", () => {
    const [load] = fileSnippets("input/a.csv", "Python 3.12.3");
    expect(load.id).toBe("load");
    expect(load.code).toContain('pd.read_csv(INPUT_DIR / "a.csv")');
    expect(load.code.split("\n")[0]).toMatch(/^# Needs pandas/);
  });

  it("says a tab-separated table's separator", () => {
    const [load] = fileSnippets("input/a.tsv", "Python 3.12.3");
    expect(load.code).toContain('pd.read_csv(INPUT_DIR / "a.tsv", sep="\\t")');
  });

  it("offers load, summarize and plot for a table", () => {
    expect(fileSnippets("input/a.csv").map((s) => s.id)).toEqual(["load", "summary", "plot"]);
  });

  it("uses base R in an R kernel, and has nothing for types R has none for", () => {
    const [load] = fileSnippets("input/a.csv", "R 4.4.1");
    expect(load.code).toBe('df <- read.csv(file.path(Sys.getenv("INPUT_DIR"), "a.csv"))\nhead(df)');
    expect(fileSnippets("input/a.nwb", "R 4.4.1")).toEqual([]);
  });

  it("has nothing for an unknown type", () => {
    expect(fileSnippets("input/README")).toEqual([]);
  });
});
