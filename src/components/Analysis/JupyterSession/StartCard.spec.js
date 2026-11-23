import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, nextTick, reactive } from "vue";
import StartCard from "./StartCard.vue";
import { starterState, notebookEmpty } from "./startCardHelpers";
import { useStartLoads } from "./useStartLoads";
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
    expect(notebookEmpty([{ cell_type: "code", source: "x = 1" }])).toBe(false);
    // A title in Markdown isn't code.
    expect(notebookEmpty([{ cell_type: "markdown", source: "# Study" }, { cell_type: "code", source: "" }])).toBe(true);
  });
});

// The card's rows, as the notebook makes them (starterRows).
const rowsOf = (inputs, list = [tables, graph]) =>
  list.map((s) => ({ ...s, code: s.layout.entry.snippets(s.path).find((x) => x.id === "load").code, state: starterState(inputs, s.source, s.layout.files) }));

describe("StartCard", () => {
  const card = (inputs, props = {}) =>
    mount(StartCard, { props: { rows: rowsOf(inputs), inputs, fmtSize, canSuggest: true, ...props } });
  const labels = (w) => w.findAll(".nb-start__btn").map((b) => b.text());
  const tablesDone = () => fakeInputs({ "metadata/models/a/versions/1/records.jsonl": done, "metadata/relationships.csv": done });

  it("says the data isn't loaded, in the kernel's language, and offers each load and a first step", () => {
    const w = card(tablesDone(), { language: "R" });
    expect(w.text()).toContain("not loaded into R yet");
    expect(labels(w)).toEqual(["Load records as tables", "Download and load records as a graph (KGX) · 2.9 KB", "Suggest a first step"]);
  });

  it("asks the notebook to load (a download that needs it, after asking)", async () => {
    const inputs = tablesDone();
    const w = card(inputs);
    await w.findAll(".nb-start__btn")[0].trigger("click");
    expect(w.emitted("load")[0][0].key).toBe("t");
    inputs.check = () => ({ ask: true, fits: true, cost: null });
    await w.findAll(".nb-start__btn")[1].trigger("click");
    expect(w.emitted("load")).toHaveLength(1);
    expect(w.find(".nb-start__confirm").text()).toContain("Download 2.9 KB?");
    await w.findAll(".nb-start__confirm .nb-start__btn")[0].trigger("click");
    expect(w.emitted("load")[1][0].key).toBe("g");
  });

  it("shows a load waiting, and an error", () => {
    const w = card(fakeInputs(), { waiting: new Set(["g"]), error: "the node is busy" });
    expect(labels(w)[1]).toBe("Loading records as a graph (KGX)…");
    expect(w.find(".nb-start__btn[disabled]").exists()).toBe(true);
    expect(w.find(".nb-start__error").text()).toContain("the node is busy");
  });

  it("offers no first step without the agent, and can be hidden", async () => {
    const w = card(fakeInputs(), { canSuggest: false });
    expect(labels(w)).not.toContain("Suggest a first step");
    await w.find(".nb-start__x").trigger("click");
    expect(w.emitted("dismiss")).toHaveLength(1);
  });
});

describe("useStartLoads", () => {
  function setup(inputs) {
    const rows = computed(() => rowsOf(inputs));
    const inserted = [];
    const loads = useStartLoads({ inputs, rows, insert: (code) => inserted.push(code) });
    return { rows, inserted, loads };
  }

  it("downloads, then puts each cell in once it's here, whatever else happens meanwhile", async () => {
    const inputs = fakeInputs();
    const { rows, inserted, loads } = setup(inputs);
    await loads.load(rows.value[0]);
    await loads.load(rows.value[1]);
    expect([...loads.waiting.value]).toEqual(["t", "g"]);
    for (const p of tables.layout.files) inputs.states[p] = done;
    await nextTick();
    expect(inserted).toEqual(['load("input/metadata")']);
    // The card is gone by now (the notebook has code): the graph's still comes.
    for (const p of graph.layout.files) inputs.states[p] = done;
    await nextTick();
    expect(inserted).toEqual(['load("input/metadata")', 'load("input/metadata/kgx")']);
    expect(loads.waiting.value.size).toBe(0);
  });

  it("lets go of a download that couldn't start, and says why", async () => {
    const inputs = fakeInputs();
    inputs.requestEntries = vi.fn(async () => {
      inputs.requestError = "the node can't fetch inputs";
    });
    const { rows, loads } = setup(inputs);
    await loads.load(rows.value[1]);
    expect(loads.waiting.value.size).toBe(0);
    expect(loads.error.value).toBe("the node can't fetch inputs");
  });

  it("lets go of a download that fails at once, and of every load for another notebook", async () => {
    const failed = { state: "failed" };
    const inputs = fakeInputs();
    inputs.requestEntries = vi.fn(async () => {
      for (const p of graph.layout.files) inputs.states[p] = failed;
    });
    const { rows, loads } = setup(inputs);
    await loads.load(rows.value[1]);
    await nextTick();
    expect(loads.waiting.value.size).toBe(0);
    expect(loads.error.value).toContain("didn't download");
    inputs.requestEntries = vi.fn(async () => {});
    await loads.load(rows.value[0]);
    expect(loads.waiting.value.size).toBe(1);
    loads.clear();
    expect(loads.waiting.value.size).toBe(0);
  });

  it("doesn't take an earlier failure for this download's", async () => {
    const failed = { state: "failed" };
    const inputs = fakeInputs({ "metadata/kgx/nodes.parquet": failed, "metadata/kgx/edges.parquet": failed });
    let begin;
    // The request returns once the sidecar has it queued (its states refreshed).
    inputs.requestEntries = vi.fn(() => new Promise((resolve) => (begin = resolve)));
    const { rows, inserted, loads } = setup(inputs);
    const asked = loads.load(rows.value[1]);
    // Something else changes while the request is on its way: the old failure isn't this one's.
    inputs.states["metadata/models/a/versions/1/records.jsonl"] = { state: "downloading", size: 100, bytes: 1 };
    await nextTick();
    expect(loads.waiting.value.has("g"), "still waiting: its download hasn't begun").toBe(true);
    for (const p of graph.layout.files) inputs.states[p] = { state: "queued", size: 1, bytes: 0 };
    begin();
    await asked;
    expect(loads.waiting.value.has("g")).toBe(true);
    inputs.states["metadata/kgx/nodes.parquet"] = done;
    inputs.states["metadata/kgx/edges.parquet"] = done;
    await nextTick();
    expect(inserted).toEqual(['load("input/metadata/kgx")']);
  });
});
