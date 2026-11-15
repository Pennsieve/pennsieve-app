import { describe, it, expect } from "vitest";
import { fileKind, fileSnippets, stackSnippets } from "./fileSnippets";
import { stackCode } from "./pathCode";

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

describe("stackSnippets", () => {
  const zarr = { cratePath: "micr/a.zarr/", location: "s3://dandiarchive/zarr/56/", region: "us-east-2" };

  it("starts with the stack's load code, then its format's own", () => {
    const list = stackSnippets(zarr, "Python 3.12.3");
    expect(list.map((s) => s.id)).toEqual(["load", "summary", "plot"]);
    expect(list[0].code).toBe(stackCode(zarr, "Python 3.12.3"));
    expect(list[2].code).toContain('z = zarr.open("s3://dandiarchive/zarr/56/", mode="r", storage_options={"anon": True, "client_kwargs": {"region_name": "us-east-2"}})');
  });

  it("plots an OME-Zarr at the finest level that fits 1024 across", () => {
    const plot = stackSnippets({ ...zarr, format: "ome-zarr" }).find((s) => s.id === "plot");
    expect(plot.code).toContain("arr = next((a for a in levels if max(a.shape[-2:]) <= 1024), levels[-1])");
  });

  it("plots a precomputed volume over https, trying levels until one has data", () => {
    const em = { cratePath: "em/", location: "s3://bossdb-open-data/w/em/", region: "us-east-1", format: "neuroglancer-precomputed" };
    const plot = stackSnippets(em).find((s) => s.id === "plot");
    expect(plot.code).toContain('CloudVolume("precomputed://https://s3.us-east-1.amazonaws.com/bossdb-open-data/w/em"');
    expect(plot.code).toContain("except EmptyVolumeException:");
  });

  it("summarizes a whole-slide image from headers only", () => {
    const slide = { cratePath: "s/", location: "s3://idc-open-data/sm-1/", format: "dicom-wsi" };
    const [, summary, show] = stackSnippets(slide);
    expect(summary.code).toContain("stop_before_pixels=True");
    expect(summary.code).toContain('fs.ls("s3://idc-open-data/sm-1/")');
    expect(show.label).toBe("Show");
  });

  it("has only the URL in R", () => {
    expect(stackSnippets(zarr, "R 4.4.1").map((s) => s.id)).toEqual(["load"]);
  });
});
