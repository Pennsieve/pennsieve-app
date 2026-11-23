import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import StartCard from "./StartCard.vue";
import { starterState, notebookEmpty } from "./startCardHelpers";
import { fmtSize } from "./fileBrowserHelpers";

const source = {
  entries: [
    { cratePath: "metadata/models/a/versions/1/records.jsonl", size: 100 },
    { cratePath: "metadata/relationships.csv", size: 50 },
    { cratePath: "metadata/kgx/nodes.parquet", size: 1000 },
    { cratePath: "metadata/kgx/edges.parquet", size: 2000 },
  ],
};
const layout = (id, label, files) => ({
  id,
  files,
  entry: { label, title: label, snippets: (path) => [{ id: "load", code: `load(${JSON.stringify(path)})` }] },
});
const tables = { key: "t", source, path: "input/metadata", layout: layout("pennsieve-records", "Records as tables", ["metadata/models/a/versions/1/records.jsonl", "metadata/relationships.csv"]) };
const graph = { key: "g", source, path: "input/metadata/kgx", layout: layout("kgx", "Records as a graph (KGX)", ["metadata/kgx/nodes.parquet", "metadata/kgx/edges.parquet"]) };

function fakeInputs(states = {}) {
  const inputs = reactive({
    states,
    stateOf: (_s, p) => inputs.states[p],
    check: () => ({ ask: false }),
    requestEntries: vi.fn((_s, entries) => {
      for (const e of entries) inputs.states[e.cratePath] = { state: "queued", size: e.size, bytes: 0 };
    }),
    noteCost: vi.fn(),
    freeBytes: null,
  });
  return inputs;
}
const done = { state: "done" };

describe("starterState", () => {
  it("says how much of a layout is in the session", () => {
    const inputs = fakeInputs({ "metadata/models/a/versions/1/records.jsonl": done, "metadata/relationships.csv": done });
    expect(starterState(inputs, source, tables.layout.files)).toMatchObject({ total: 2, done: 2, all: true, under: false, left: [] });
    const g = starterState(inputs, source, graph.layout.files);
    expect(g).toMatchObject({ all: false, under: false, leftBytes: 3000 });
    inputs.states["metadata/kgx/nodes.parquet"] = { state: "downloading", size: 1000, bytes: 500 };
    expect(starterState(inputs, source, graph.layout.files)).toMatchObject({ under: true, percent: 50, leftBytes: 2000 });
  });

  it("knows an empty notebook", () => {
    expect(notebookEmpty([{ source: "" }, { source: "  \n" }])).toBe(true);
    expect(notebookEmpty([{ source: "x = 1" }])).toBe(false);
  });
});

describe("StartCard", () => {
  const card = (inputs, props = {}) => mount(StartCard, { props: { starters: [tables, graph], inputs, fmtSize, canSuggest: true, ...props } });
  const labels = (w) => w.findAll(".nb-start__btn").map((b) => b.text());

  it("says the data isn't loaded, and offers to load each layout and a first step", () => {
    const w = card(fakeInputs({ "metadata/models/a/versions/1/records.jsonl": done, "metadata/relationships.csv": done }));
    expect(w.text()).toContain("not loaded into Python yet");
    expect(labels(w)).toEqual(["Load records as tables", "Download and load records as a graph (KGX) · 2.9 KB", "Suggest a first step"]);
  });

  it("loads what's downloaded at once", async () => {
    const w = card(fakeInputs({ "metadata/models/a/versions/1/records.jsonl": done, "metadata/relationships.csv": done }));
    await w.findAll(".nb-start__btn")[0].trigger("click");
    expect(w.emitted("insert-snippet")).toEqual([['load("input/metadata")']]);
  });

  it("downloads first, then puts the cell in once it's all here", async () => {
    const inputs = fakeInputs();
    const w = card(inputs);
    await w.findAll(".nb-start__btn")[1].trigger("click");
    expect(inputs.requestEntries).toHaveBeenCalledWith(source, graph.layout.files.map((p) => source.entries.find((e) => e.cratePath === p)));
    expect(labels(w)[1]).toBe("Downloading records as a graph (KGX)… 0%");
    expect(w.emitted("insert-snippet")).toBeUndefined();
    inputs.states["metadata/kgx/nodes.parquet"] = done;
    inputs.states["metadata/kgx/edges.parquet"] = done;
    await nextTick();
    expect(w.emitted("insert-snippet")).toEqual([['load("input/metadata/kgx")']]);
  });

  it("asks first for a download that needs it", async () => {
    const inputs = fakeInputs();
    inputs.check = () => ({ ask: true, fits: true, cost: null });
    const w = card(inputs);
    await w.findAll(".nb-start__btn")[1].trigger("click");
    expect(inputs.requestEntries).not.toHaveBeenCalled();
    expect(w.find(".nb-start__confirm").text()).toContain("Download 2.9 KB?");
    await w.findAll(".nb-start__confirm .nb-start__btn")[0].trigger("click");
    expect(inputs.requestEntries).toHaveBeenCalled();
  });

  it("offers no first step without the agent, and can be hidden", async () => {
    const w = card(fakeInputs(), { canSuggest: false });
    expect(labels(w)).not.toContain("Suggest a first step");
    await w.find(".nb-start__x").trigger("click");
    expect(w.emitted("dismiss")).toHaveLength(1);
  });
});
