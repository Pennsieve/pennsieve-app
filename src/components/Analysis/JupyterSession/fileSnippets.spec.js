import { describe, it, expect } from "vitest";
import { metadataNote, STARTER_NOTE, fileKind, fileSnippets, folderSnippets, metadataFolder, stackSnippets } from "./fileSnippets";
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
    const [note, needs] = load.code.split("\n");
    expect(note).toBe(STARTER_NOTE);
    expect(needs).toMatch(/^# Needs pandas/);
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
    expect(load.code).toBe(`${STARTER_NOTE}\ndf <- read.csv(file.path(Sys.getenv("INPUT_DIR"), "a.csv"))\nhead(df)`);
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
    expect(list[0].code).toBe(`${STARTER_NOTE}\n${stackCode(zarr, "Python 3.12.3")}`);
    expect(list.every((s) => s.code.startsWith(STARTER_NOTE))).toBe(true);
    expect(list[2].code).toContain('z = zarr.open("s3://dandiarchive/zarr/56/", mode="r", storage_options={"anon": True, "client_kwargs": {"region_name": "us-east-2"}})');
  });

  it("plots an OME-Zarr at the finest level that fits 1024 across", () => {
    const plot = stackSnippets({ ...zarr, format: "ome-zarr" }).find((s) => s.id === "plot");
    expect(plot.code).toContain("arr = next((a for a in levels if max(a.shape[-2:]) <= 1024), levels[-1])");
  });

  it("plots a precomputed volume over https, trying levels until one has data, missing chunks as zeros", () => {
    const em = { cratePath: "em/", location: "s3://bossdb-open-data/w/em/", region: "us-east-1", format: "neuroglancer-precomputed" };
    const plot = stackSnippets(em).find((s) => s.id === "plot");
    expect(plot.code).toContain('CloudVolume("precomputed://https://s3.us-east-1.amazonaws.com/bossdb-open-data/w/em"');
    expect(plot.code).toContain("fill_missing=True");
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

describe("metadataFolder", () => {
  it("knows a view's metadata folders by their path in the view", () => {
    expect(metadataFolder("metadata/")).toEqual({ level: "metadata", model: null });
    expect(metadataFolder("metadata/models/case/")).toEqual({ level: "model", model: "case" });
    expect(metadataFolder("metadata/kgx/")).toEqual({ level: "kgx", model: null });
    expect(metadataFolder("metadata/kgx")).toEqual({ level: "kgx", model: null });
    expect(metadataFolder("metadata/kgx/sub/")).toBeNull();
    expect(metadataFolder("files/metadata/kgx/")).toBeNull();
  });

  it("knows nothing of other folders, whatever their name", () => {
    expect(metadataFolder("files/metadata/")).toBeNull();
    expect(metadataFolder("data/metadata/models/case/")).toBeNull();
    expect(metadataFolder("metadata/models/")).toBeNull();
    expect(metadataFolder("metadata/models/case/versions/")).toBeNull();
    // Only metadata-service model names: anything else could inject code.
    expect(metadataFolder('metadata/models/x{print(1)}/')).toBeNull();
    expect(metadataFolder("metadata/models/a\nb/")).toBeNull();
    expect(metadataFolder('metadata/models/a"b/')).toBeNull();
    expect(metadataFolder("metadata/models/Case/")).toBeNull();
    expect(folderSnippets("input/v/metadata/models/x{y}", "metadata/models/x{y}/")).toEqual([]);
    expect(metadataFolder("")).toBeNull();
    expect(metadataFolder(undefined)).toBeNull();
  });
});

describe("folderSnippets", () => {
  const py = "Python 3.12.3";
  it("offers Load, Query and Summarize on the metadata folder", () => {
    const [load, query, summary] = folderSnippets("input/v/metadata", "metadata/", py);
    expect([load.id, query.id, summary.id]).toEqual(["load", "query", "summary"]);
    expect(load.code).toContain("SELECT model, count(*) AS records FROM meta.records");
    expect(load.code).toContain(`# In later cells: con.sql('SELECT * FROM "<model>"').df()`);
    expect(summary.code.split("\n")[0]).toBe(metadataNote("pandas"));
    expect(load.code.split("\n")[0]).toBe(metadataNote("DuckDB"));
    expect(load.code.split("\n")[0]).toMatch(/no Pennsieve library needed$/);
    expect(summary.code).toContain('metadata = Path(INPUT_DIR / "v/metadata")');
    expect(summary.code).toContain("x-pennsieve-key");
    expect(query.code).toMatch(/^# Needs duckdb, pandas/m);
    expect(query.code).toContain("CREATE OR REPLACE VIEW meta.records");
    expect(query.code).toContain("JOIN meta.records AS t ON t.record_id = r.target_record_id");
  });

  it("offers nothing on the models folder: the metadata folder covers every model", () => {
    expect(folderSnippets("input/v/metadata/models", "metadata/models/", py)).toEqual([]);
  });

  it("loads, queries and summarizes a model by its quoted name", () => {
    const [load, query, summary] = folderSnippets("input/v/metadata/models/case", "metadata/models/case/", py);
    expect([load.id, query.id, summary.id]).toEqual(["load", "query", "summary"]);
    expect(load.code).toContain('SELECT * FROM "case" LIMIT 10');
    expect(load.code).not.toContain("# Examples");
    expect(load.code).toContain(`# In later cells: con.sql('SELECT * FROM "case"').df()`);
    expect(load.code).toContain('CREATE OR REPLACE VIEW \\"case\\" AS');
    expect(load.code).not.toContain("VIEW meta.records");
    expect(summary.code).not.toContain("VIEW meta.records");
    expect(query.code).toContain("VIEW meta.records");
    expect(query.code).toContain("JOIN meta.relationships AS r ON r.source_record_id = m.record_id");
    expect(summary.code).toContain('SUMMARIZE "case"');
    expect(summary.code).toContain('(metadata / "models" / "case" / "versions")');
    expect(query.code).toContain('metadata = Path(INPUT_DIR / "v/metadata")');
  });

  it("loads, queries and walks the knowledge graph from its Parquet files", () => {
    const [load, query, nx] = folderSnippets("input/v/metadata/kgx/", "metadata/kgx/", py);
    expect([load.id, query.id, nx.id]).toEqual(["load", "query", "networkx"]);
    expect(load.code.split("\n")[0]).toMatch(/knowledge graph \(KGX tables\): plain DuckDB, no Pennsieve library needed$/);
    expect(load.code).toContain('kgx = Path(INPUT_DIR / "v/metadata/kgx")');
    expect(load.code).toContain("CREATE OR REPLACE VIEW nodes AS SELECT * FROM read_parquet(");
    expect(load.code).toContain("SELECT predicate, count(*) AS edges FROM edges");
    expect(query.code).toContain("WHERE a.predicate = 'biolink:has_attribute'");
    expect(query.code).toContain("JOIN edges AS b ON b.object = a.object AND b.subject <> a.subject");
    expect(nx.code).toMatch(/^# Needs pandas, networkx \(/m);
    expect(nx.code).toContain('nodes = pd.read_csv(kgx / "nodes.tsv.gz", usecols=["id", "category", "name"], **tsv)');
    expect(nx.code).toContain('edges = pd.read_csv(kgx / "edges.tsv.gz", usecols=["subject", "predicate", "object"], **tsv)');
    expect(nx.code).not.toContain("parquet");
    expect(nx.code).toContain('nx.from_pandas_edgelist(edges, "subject", "object", edge_attr=["predicate"], create_using=nx.MultiDiGraph)');
    expect(folderSnippets("input/v/metadata/kgx", "metadata/kgx/", "R 4.4.1")).toEqual([]);
  });

  it("keeps a large graph out of NetworkX: degrees in pandas, the graph around a hub", () => {
    const nx = folderSnippets("input/v/metadata/kgx", "metadata/kgx/", py).find((s) => s.id === "networkx");
    expect(nx.code).toContain('degree = pd.concat([edges.subject, edges.object]).value_counts()');
    expect(nx.code).toContain("whole = len(edges) <= 500000");
    expect(nx.code).toContain("edges = edges[edges.subject.isin(seed) | edges.object.isin(seed)]");
    // The graph is built after the cut, from the edges it keeps.
    expect(nx.code.indexOf("edges = edges[")).toBeLessThan(nx.code.indexOf("nx.from_pandas_edgelist"));
  });

  it("holds DuckDB to half the session's memory in every DuckDB starter", () => {
    const duck = [
      ...folderSnippets("input/v/metadata/kgx", "metadata/kgx/", py),
      ...folderSnippets("input/v/metadata", "metadata/", py),
      ...folderSnippets("input/v/metadata/models/case", "metadata/models/case/", py),
    ].filter((s) => s.code.includes("duckdb"));
    expect(duck.length).toBeGreaterThan(5);
    for (const s of duck) {
      expect(s.code).toContain(`con = duckdb.connect(config={"memory_limit": f"{os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') // 2**21}MB"})`);
      expect(s.code).not.toContain("duckdb.connect()");
    }
  });

  it("has none in R, or for a folder that isn't a view's metadata folder", () => {
    expect(folderSnippets("input/v/metadata", "metadata/", "R 4.4.1")).toEqual([]);
    expect(folderSnippets("input/v/files/metadata", "files/metadata/", py)).toEqual([]);
  });
});
