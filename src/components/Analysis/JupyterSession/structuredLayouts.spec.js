import { describe, it, expect } from "vitest";
import { LAYOUTS, layoutsOf, layoutAt, kgxSummary, parseKgxGraph, recordsModels, crateRoot } from "./structuredLayouts";

const KGX = "https://schemas.pennsieve.io/structures/kgx";
const kgxFiles = ["nodes.tsv.gz", "edges.tsv.gz", "nodes.parquet", "edges.parquet", "graph.json", "graph_stats.yaml"].map((f) => `metadata/kgx/${f}`);

const crate = (root) => ({ "@graph": [{ "@id": "view.json" }, { "@id": "./", ...root }] });
const models = [
  { source: "s", name: "drug", version: 2, schema: "metadata/models/drug/versions/2/schema.json", records: "metadata/models/drug/versions/2/records.jsonl" },
  { source: "s", name: "case", version: 1, schema: "metadata/models/case/versions/1/schema.json", records: "metadata/models/case/versions/1/records.jsonl" },
  { source: "s", name: "drug", version: 1, schema: "metadata/models/drug/versions/1/schema.json", records: "metadata/models/drug/versions/1/records.jsonl" },
];

describe("structured layouts: the registry", () => {
  it("has one entry per structure, each with what the browser needs", () => {
    expect(LAYOUTS.map((l) => l.id)).toEqual(["pennsieve-records", "kgx"]);
    for (const l of LAYOUTS) {
      expect(l.conformsTo).toBe(`https://schemas.pennsieve.io/structures/${l.id}`);
      expect(l.spec).toMatch(new RegExp(`^${l.conformsTo}/v\\d`));
      expect(l.label && l.icon && l.folder).toBeTruthy();
      expect(["bundle", "folder"]).toContain(l.presentation);
      expect(typeof l.snippets).toBe("function");
    }
  });

  it("keeps the records a folder (with a badge) and makes the graph a bundle", () => {
    const [records, kgx] = LAYOUTS;
    expect([records.folder, records.presentation]).toEqual(["metadata", "folder"]);
    expect([kgx.folder, kgx.presentation]).toEqual(["metadata/kgx", "bundle"]);
  });

  it("gives the code each layout's own folder", () => {
    const [records, kgx] = LAYOUTS;
    expect(records.codePath("input/faers/metadata/")).toBe("input/faers/metadata");
    expect(kgx.codePath("input/faers/metadata/kgx/")).toBe("input/faers/metadata/kgx");
    // The existing snippets: the records' Load / Query / Summarize, the graph's Load / Query / NetworkX.
    expect(records.snippets("input/faers/metadata", "Python 3.12").map((s) => s.id)).toEqual(["load", "query", "summary"]);
    expect(records.snippets("input/faers/metadata", "Python 3.12")[0].code).toContain('INPUT_DIR / "faers/metadata"');
    expect(kgx.snippets("input/faers/metadata/kgx", "Python 3.12").map((s) => s.label)).toEqual(["Load", "Query", "NetworkX"]);
    expect(kgx.snippets("input/faers/metadata/kgx", "R 4.4")).toEqual([]);
  });
});

describe("structured layouts: detection", () => {
  it("reads the declared layouts from the crate (views:layouts, views:models)", () => {
    const layouts = layoutsOf(
      crate({
        "views:models": models,
        "views:relationships": [{ source: "s", path: "metadata/relationships.csv" }],
        "views:layouts": [{ source: "s", conformsTo: KGX, folder: "metadata/kgx", files: kgxFiles }],
      }),
      [] // the entries aren't read when the crate says
    );
    expect(layouts.map((l) => [l.id, l.folder])).toEqual([
      ["pennsieve-records", "metadata"],
      ["kgx", "metadata/kgx"],
    ]);
    expect(layouts[0].files).toContain("metadata/relationships.csv");
    expect(layouts[0].files).toContain("metadata/models/case/versions/1/schema.json");
    expect(layouts[0].models).toEqual([
      { name: "case", versions: [{ version: 1, records: "metadata/models/case/versions/1/records.jsonl" }] },
      {
        name: "drug",
        versions: [
          { version: 1, records: "metadata/models/drug/versions/1/records.jsonl" },
          { version: 2, records: "metadata/models/drug/versions/2/records.jsonl" },
        ],
      },
    ]);
    expect(layouts[1].files).toEqual(kgxFiles);
  });

  it("trusts the crate's views:layouts: a kgx folder it doesn't list is a plain folder", () => {
    const entries = kgxFiles.map((cratePath) => ({ cratePath }));
    expect(layoutsOf(crate({ "views:layouts": [] }), entries)).toEqual([]);
  });

  it("finds the other layouts by path in a crate from before views:layouts", () => {
    const entries = kgxFiles.map((cratePath) => ({ cratePath }));
    const layouts = layoutsOf(crate({ "views:models": models }), entries);
    expect(layouts.map((l) => [l.id, l.folder])).toEqual([
      ["pennsieve-records", "metadata"],
      ["kgx", "metadata/kgx"],
    ]);
    expect(layoutsOf(crate({}), [])).toEqual([]);
  });

  it("leaves out unknown structures, empty layouts and unsafe paths", () => {
    const layouts = layoutsOf(
      crate({
        "views:layouts": [
          { conformsTo: "https://example.org/other", folder: "metadata/other", files: ["metadata/other/a"] },
          { conformsTo: KGX, folder: "metadata/kgx", files: [] },
          { conformsTo: KGX, folder: "../etc", files: ["../etc/passwd"] },
          { conformsTo: "kgx", folder: "metadata/kgx/", files: ["metadata/kgx/graph.json", "/abs", "a/../b", "files/elsewhere.csv"] },
        ],
      })
    );
    expect(layouts).toEqual([{ id: "kgx", folder: "metadata/kgx", files: ["metadata/kgx/graph.json"] }]);
  });

  it("matches by path when the view's crate can't be read (views before views:layouts)", () => {
    const entries = [
      ...kgxFiles,
      "metadata/models/drug/versions/1/schema.json",
      "metadata/models/drug/versions/1/records.jsonl",
      "metadata/relationships.csv",
      "files/a.csv",
    ].map((cratePath) => ({ cratePath, size: 1 }));
    const layouts = layoutsOf(null, entries);
    expect(layouts.map((l) => l.id)).toEqual(["pennsieve-records", "kgx"]);
    expect(layouts[0].files).toEqual([
      "metadata/models/drug/versions/1/schema.json",
      "metadata/models/drug/versions/1/records.jsonl",
      "metadata/relationships.csv",
    ]);
    expect(layouts[0].models).toEqual([{ name: "drug", versions: [{ version: 1, records: "metadata/models/drug/versions/1/records.jsonl" }] }]);
    expect(layoutsOf(null, [{ cratePath: "files/a.csv" }])).toEqual([]);
  });

  it("finds a folder's layout by its path in the view", () => {
    const layouts = layoutsOf(null, kgxFiles.map((cratePath) => ({ cratePath })));
    expect(layoutAt(layouts, "metadata/kgx/").entry.label).toBe("Knowledge graph (KGX)");
    expect(layoutAt(layouts, "metadata/")).toBeNull();
    expect(layoutAt(layoutsOf(crate({ "views:models": models })), "metadata/").entry.presentation).toBe("folder");
    expect(layoutAt(layouts, "files/metadata/kgx/")).toBeNull();
  });

  it("finds the crate's root", () => {
    expect(crateRoot(crate({ name: "v" })).name).toBe("v");
    expect(crateRoot({})).toBeNull();
    expect(crateRoot(null)).toBeNull();
  });
});

describe("structured layouts: summaries", () => {
  const graph = {
    layout: "kgx",
    layout_version: "1.0",
    conforms_to: KGX,
    biolink: "none",
    source: { dataset_id: 42, dataset_node_id: "N:dataset:1", mode: "view", view_id: "5138c7de", view_version: "v3" },
    generated_at: "2026-11-21T14:20:00Z",
    counts: {
      nodes: 30964,
      edges: 43901,
      dropped_edges: 0,
      nodes_by_category: { "pennsieve:drug": 9000, "pennsieve:case": 12000, "pennsieve:reaction": 9964 },
      edges_by_predicate: { "pennsieve:has_drug": 20000, "pennsieve:has_reaction": 23901 },
    },
  };

  it("reads graph.json's counts, Biolink coverage, source and time", () => {
    const s = parseKgxGraph(JSON.stringify(graph));
    expect(s.nodes).toBe(30964);
    expect(s.edges).toBe(43901);
    expect(s.categories.map((c) => c.name)).toEqual(["pennsieve:case", "pennsieve:reaction", "pennsieve:drug"]);
    expect(s.predicates[0]).toEqual({ name: "pennsieve:has_reaction", count: 23901 });
    expect(s.biolink).toBe("none");
    expect(s.generatedAt).toBe("2026-11-21T14:20:00Z");
    expect(s.datasetNodeId).toBe("N:dataset:1");
  });

  it("keeps only well-typed values, and nothing for what isn't graph.json", () => {
    const s = kgxSummary({ biolink: "<b>all</b>", counts: { nodes: "many", nodes_by_category: { a: -1, b: 2, c: "3" } }, source: "x" });
    expect(s.biolink).toBe("");
    expect(s.nodes).toBeNull();
    expect(s.categories).toEqual([{ name: "b", count: 2 }]);
    expect(s.datasetNodeId).toBe("");
    expect(parseKgxGraph(null)).toBeNull();
    expect(parseKgxGraph("not json")).toBeNull();
    expect(parseKgxGraph("[1, 2]")).toBeNull();
  });

  it("groups the records' models by name with their versions", () => {
    expect(recordsModels([{ name: "a", version: 1 }, { name: "a", version: "2" }, null, { version: 1 }])).toEqual([{ name: "a", versions: [{ version: 1, records: "" }] }]);
  });
});
