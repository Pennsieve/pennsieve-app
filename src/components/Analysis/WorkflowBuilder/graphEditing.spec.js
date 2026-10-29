import { describe, it, expect, vi } from "vitest";
import { nextTick, ref } from "vue";
import { canConnect, neighbourInDirection } from "./graphEditing";
import { snapshotKey, snapshot, useGraphHistory } from "./graphHistory";

const n = (id, type, x, y) => ({ id, type, position: { x, y }, data: { label: id } });

describe("canConnect", () => {
  const s = n("s", "data-source", 0, 0), a = n("a", "default", 0, 100), t = n("t", "data-target", 0, 200);
  it("allows input → app → output, once", () => {
    expect(canConnect(s, a)).toBe(true);
    expect(canConnect(a, t)).toBe(true);
    expect(canConnect(a, t, [{ source: "a", target: "t" }])).toBe(false);
  });
  it("refuses into an input, out of an output, and to itself", () => {
    expect(canConnect(a, s)).toBe(false);
    expect(canConnect(t, a)).toBe(false);
    expect(canConnect(a, a)).toBe(false);
    expect(canConnect(a, undefined)).toBe(false);
  });
});

describe("neighbourInDirection", () => {
  const nodes = [n("s", "data-source", 0, 0), n("a", "default", -100, 100), n("b", "default", 100, 100), n("t", "data-target", 0, 200)];
  const edges = [{ source: "s", target: "a" }, { source: "s", target: "b" }, { source: "a", target: "t" }];
  it("goes down to what a step feeds, up to what feeds it, sideways along its row", () => {
    expect(neighbourInDirection(nodes, edges, "a", "down")).toBe("t");
    expect(neighbourInDirection(nodes, edges, "t", "up")).toBe("a");
    expect(neighbourInDirection(nodes, edges, "a", "right")).toBe("b");
    expect(neighbourInDirection(nodes, edges, "b", "left")).toBe("a");
    expect(neighbourInDirection(nodes, edges, "a", "left")).toBe(null);
  });
});

describe("graph history", () => {
  it("keys snapshots by what was edited, not by selection or ports", () => {
    const a = { ...n("a", "default", 0.2, 0), data: { label: "a", cpu: "1024", manifestPorts: { inputs: [] } } };
    const b = { ...a, selected: true, position: { x: 0.4, y: 0 }, data: { label: "a", cpu: "1024" } };
    expect(snapshotKey(snapshot([a], []))).toBe(snapshotKey(snapshot([b], [])));
    expect(snapshotKey(snapshot([{ ...b, data: { label: "a", cpu: "2048" } }], []))).not.toBe(snapshotKey(snapshot([a], [])));
  });

  it("undoes and redoes edits as they settle", async () => {
    vi.useFakeTimers();
    const nodes = ref([n("s", "data-source", 0, 0)]);
    const edges = ref([]);
    const h = useGraphHistory({ nodes, edges });
    h.reset();

    nodes.value.push(n("a", "default", 0, 100));
    await nextTick();
    vi.advanceTimersByTime(400);
    nodes.value[1].data.cpu = "2048";
    await nextTick();
    vi.advanceTimersByTime(400);
    expect(h.canUndo()).toBe(true);

    h.undo();
    expect(nodes.value[1].data.cpu).toBeUndefined();
    vi.advanceTimersByTime(500);
    h.undo();
    expect(nodes.value.map((x) => x.id)).toEqual(["s"]);
    vi.advanceTimersByTime(500);
    expect(h.canUndo()).toBe(false);

    h.redo();
    vi.advanceTimersByTime(500);
    h.redo();
    expect(nodes.value[1].data.cpu).toBe("2048");
    expect(h.canRedo()).toBe(false);
    vi.useRealTimers();
  });
});
