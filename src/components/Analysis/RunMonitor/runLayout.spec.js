import { describe, it, expect, vi } from "vitest";
import { savedLayoutOf, placeRunNodes, createLayoutCache } from "./runLayout";

const BOX = { width: 280, height: 80 };
const at = (x, y) => ({ x, y });

describe("savedLayoutOf", () => {
  it("reads the steps' positions, and the inputs' and outputs'", () => {
    const wf = {
      dag: [{ id: "prep", position: at(805, 194) }, { id: "qc" }],
      inputs: [{ id: "fcs", position: at(845, 0) }],
      outputs: [{ id: "report_out", from: { step: "prep" }, position: at(350, 1694) }],
    };
    expect(savedLayoutOf(wf)).toEqual({ prep: at(805, 194), fcs: at(845, 0), report_out: at(350, 1694) });
  });

  it("reads a workflow without an interface, and nothing", () => {
    expect(savedLayoutOf({ dag: [{ id: "a", position: at(1, 2) }] })).toEqual({ a: at(1, 2) });
    expect(savedLayoutOf({ processors: [{ id: "a", position: at(1, 2) }] })).toEqual({ a: at(1, 2) });
    expect(savedLayoutOf(null)).toEqual({});
    expect(savedLayoutOf({ dag: [{ id: "a", position: { x: "1", y: 2 } }] })).toEqual({});
  });
});

describe("placeRunNodes", () => {
  // A run started with crude grid positions; the workflow was laid out since.
  const run = [
    { id: "fcs", position: at(40, 300) },
    { id: "prep", position: at(300, 300) },
    { id: "qc", position: at(560, 300) },
  ];

  it("places the nodes as the workflow is laid out now", () => {
    const layout = { fcs: at(845, 0), prep: at(805, 194), qc: at(130, 444) };
    expect(placeRunNodes(run, layout, { box: BOX })).toEqual({ positions: layout, needsAutoLayout: false });
  });

  it("keeps the run's position for a step the workflow no longer has", () => {
    const layout = { fcs: at(0, 0), prep: at(0, 300) };
    const r = placeRunNodes(run, layout, { box: BOX });
    expect(r.needsAutoLayout).toBe(false);
    expect(r.positions).toEqual({ fcs: at(0, 0), prep: at(0, 300), qc: at(560, 300) });
  });

  it("lays the graph out when such a step would land on another", () => {
    const layout = { fcs: at(0, 0), prep: at(560, 320) };
    expect(placeRunNodes(run, layout, { box: BOX }).needsAutoLayout).toBe(true);
  });

  it("lays the graph out when such a step has no position of its own", () => {
    const layout = { fcs: at(0, 0), prep: at(0, 300) };
    const r = placeRunNodes([...run.slice(0, 2), { id: "qc" }], layout, { box: BOX });
    expect(r.needsAutoLayout).toBe(true);
  });

  it("uses the run's own positions when the workflow's layout places too few", () => {
    const layout = { fcs: at(0, 0), other: at(9, 9) };
    const r = placeRunNodes(run, layout, { box: BOX });
    expect(r).toEqual({ positions: { fcs: at(40, 300), prep: at(300, 300), qc: at(560, 300) }, needsAutoLayout: false });
  });

  it("uses the run's own positions when the workflow's layout couldn't be read", () => {
    expect(placeRunNodes(run, null, { box: BOX }).positions.qc).toEqual(at(560, 300));
    expect(placeRunNodes(run, {}, { box: BOX }).needsAutoLayout).toBe(false);
  });

  it("lays the graph out when nothing places every node", () => {
    expect(placeRunNodes([{ id: "a" }, { id: "b" }], null, { box: BOX }).needsAutoLayout).toBe(true);
    expect(placeRunNodes([{ id: "a", position: at(0, 0) }, { id: "b" }], {}, { box: BOX }).needsAutoLayout).toBe(true);
    expect(placeRunNodes([], {}, { box: BOX }).needsAutoLayout).toBe(true);
  });

  it("takes the share it needs as an option", () => {
    const wide = [{ id: "a", position: at(0, 0) }, { id: "b", position: at(0, 500) }, { id: "c", position: at(0, 1000) }];
    const layout = { a: at(1000, 0) };
    expect(placeRunNodes(wide, layout, { box: BOX, minShare: 0.3 }).positions.a).toEqual(at(1000, 0));
    expect(placeRunNodes(wide, layout, { box: BOX }).positions.a).toEqual(at(0, 0));
  });
});

describe("createLayoutCache", () => {
  const definition = { dag: [{ id: "a", position: at(1, 2) }] };

  it("fetches a workflow's layout once", async () => {
    const cache = createLayoutCache();
    const fetch = vi.fn().mockResolvedValue(definition);
    expect(await cache.get("wf", fetch)).toEqual({ a: at(1, 2) });
    expect(await cache.get("wf", fetch)).toEqual({ a: at(1, 2) });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches it again once forgotten, or after a while", async () => {
    let t = 0;
    const cache = createLayoutCache({ ttlMs: 100, now: () => t });
    const fetch = vi.fn().mockResolvedValue(definition);
    await cache.get("wf", fetch);
    cache.forget("wf");
    await cache.get("wf", fetch);
    t = 150;
    await cache.get("wf", fetch);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives null on a failure, and tries again next time", async () => {
    const cache = createLayoutCache();
    const fetch = vi.fn().mockRejectedValueOnce(new Error("403")).mockResolvedValue(definition);
    expect(await cache.get("wf", fetch)).toBeNull();
    expect(await cache.get("wf", fetch)).toEqual({ a: at(1, 2) });
  });

  it("gives null without a workflow", async () => {
    const fetch = vi.fn();
    expect(await createLayoutCache().get("", fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
