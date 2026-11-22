import { describe, it, expect, vi } from "vitest";
import {
  holdPendingInputs,
  pendingInputsOf,
  dropPendingInput,
  sweepPendingInputs,
  sessionFolderName,
  pendingFolderName,
  attachPendingInput,
  nodeAddsViews,
  splitSessionViews,
  PENDING_TTL_MS,
} from "./pendingSessionInputs";

// A Storage-like map; throwing, a private window's.
function memoryStorage() {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    map: m,
  };
}
const blocked = {
  get length() {
    throw new Error("blocked");
  },
  key() {
    throw new Error("blocked");
  },
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

const input = (viewId, name = "Mouse-study-Input-data") => ({ nodeId: "n1", name, viewId, version: 1, datasetId: "N:dataset:1", label: "Mouse study: Input data" });

describe("pending session inputs", () => {
  it("are kept for the run, in storage too, until each is dropped", () => {
    const storage = memoryStorage();
    holdPendingInputs("run-a", [input("v1"), input("v2", "other")], { storage, now: () => 1000 });
    expect(pendingInputsOf("run-a", { storage, now: () => 2000 }).map((i) => i.viewId)).toEqual(["v1", "v2"]);
    expect(JSON.parse(storage.getItem("pennsieve.pendingSessionInputs.run-a")).inputs).toHaveLength(2);
    dropPendingInput("run-a", "v1", { storage });
    expect(pendingInputsOf("run-a", { storage, now: () => 2000 }).map((i) => i.viewId)).toEqual(["v2"]);
    dropPendingInput("run-a", "v2", { storage });
    expect(pendingInputsOf("run-a", { storage, now: () => 2000 })).toEqual([]);
    expect(storage.getItem("pennsieve.pendingSessionInputs.run-a")).toBe(null);
  });

  it("survive a reload from storage", () => {
    const storage = memoryStorage();
    storage.setItem("pennsieve.pendingSessionInputs.run-b", JSON.stringify({ at: 5000, inputs: [input("v9")] }));
    expect(pendingInputsOf("run-b", { storage, now: () => 6000 })[0].viewId).toBe("v9");
  });

  it("are let go a day on", () => {
    const storage = memoryStorage();
    holdPendingInputs("run-c", [input("v1")], { storage, now: () => 0 });
    expect(pendingInputsOf("run-c", { storage, now: () => PENDING_TTL_MS + 1 })).toEqual([]);
    expect(storage.getItem("pennsieve.pendingSessionInputs.run-c")).toBe(null);
    // Other runs' old entries go when new ones are held.
    storage.setItem("pennsieve.pendingSessionInputs.old", JSON.stringify({ at: 0, inputs: [input("v0")] }));
    storage.setItem("pennsieve.pendingSessionInputs.junk", "{not json");
    storage.setItem("other.key", "kept");
    sweepPendingInputs({ storage, now: () => PENDING_TTL_MS + 10 });
    expect(storage.getItem("pennsieve.pendingSessionInputs.old")).toBe(null);
    expect(storage.getItem("pennsieve.pendingSessionInputs.junk")).toBe(null);
    expect(storage.getItem("other.key")).toBe("kept");
  });

  it("work in memory where storage is blocked", () => {
    expect(() => holdPendingInputs("run-d", [input("v1")], { storage: blocked, now: () => 1 })).not.toThrow();
    expect(pendingInputsOf("run-d", { storage: blocked, now: () => 2 })[0].viewId).toBe("v1");
    expect(() => dropPendingInput("run-d", "v1", { storage: blocked })).not.toThrow();
    expect(pendingInputsOf("run-d", { storage: blocked, now: () => 2 })).toEqual([]);
  });
});

describe("a pending input's folder", () => {
  it("is named as the sidecar names the view a session starts with", () => {
    expect(sessionFolderName("Mouse study: Input data")).toBe("Mouse-study-Input-data");
    expect(sessionFolderName("  ..Ünïcode / ok_1.2  ")).toBe("n-code-ok_1.2");
    expect(sessionFolderName("::")).toBe("dataset");
    const long = sessionFolderName(`${"a".repeat(59)} b ${"c".repeat(40)}`);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toBe("a".repeat(59));
  });

  it("is the input's node id when the notebook has several", () => {
    expect(pendingFolderName({ viewName: "D: Input", nodeId: "node-1", only: true })).toBe("D-Input");
    expect(pendingFolderName({ viewName: "D: Input", nodeId: "node-1", only: false })).toBe("node-1");
  });
});

describe("joining the session", () => {
  const noSleep = () => Promise.resolve();

  it("waits for the view, then adds it at its built version", async () => {
    const waitForView = vi.fn().mockResolvedValue({ id: "v1", version: 2 });
    const addInputSource = vi.fn().mockResolvedValue([]);
    const name = await attachPendingInput(input("v1"), { waitForView, addInputSource, sleep: noSleep });
    expect(name).toBe("Mouse-study-Input-data");
    expect(addInputSource).toHaveBeenCalledWith("Mouse-study-Input-data", "v1", 2);
  });

  it("takes the next free folder", async () => {
    const waitForView = vi.fn().mockResolvedValue({ id: "v1", version: 1 });
    const taken409 = Object.assign(new Error("exists"), { status: 409, source: "sidecar" });
    const addInputSource = vi.fn().mockRejectedValueOnce(taken409).mockResolvedValue([]);
    const name = await attachPendingInput(input("v1", "x"), { waitForView, addInputSource, taken: new Set(["x"]), sleep: noSleep });
    expect(name).toBe("x-3");
    expect(addInputSource.mock.calls.map((c) => c[0])).toEqual(["x-2", "x-3"]);
  });

  it("tries a transient failure again, and not a refusal", async () => {
    const waitForView = vi.fn().mockResolvedValue({ id: "v1", version: 1 });
    const down = Object.assign(new Error("bad gateway"), { status: 502 });
    const addInputSource = vi.fn().mockRejectedValueOnce(down).mockResolvedValue([]);
    await expect(attachPendingInput(input("v1"), { waitForView, addInputSource, sleep: noSleep })).resolves.toBe("Mouse-study-Input-data");
    expect(addInputSource).toHaveBeenCalledTimes(2);

    const refused = Object.assign(new Error("only the run's creator"), { status: 403, source: "run" });
    const refuses = vi.fn().mockRejectedValue(refused);
    await expect(attachPendingInput(input("v1"), { waitForView, addInputSource: refuses, sleep: noSleep })).rejects.toBe(refused);
    expect(refuses).toHaveBeenCalledTimes(1);

    const always = vi.fn().mockRejectedValue(down);
    await expect(attachPendingInput(input("v1"), { waitForView, addInputSource: always, sleep: noSleep, tries: 3 })).rejects.toBe(down);
    expect(always).toHaveBeenCalledTimes(3);
  });

  it("stops at a failed build", async () => {
    const failed = Object.assign(new Error("The dataset's records couldn't be prepared."), { name: "ViewBuildError" });
    const waitForView = vi.fn().mockRejectedValue(failed);
    const addInputSource = vi.fn();
    await expect(attachPendingInput(input("v1"), { waitForView, addInputSource, sleep: noSleep })).rejects.toBe(failed);
    expect(waitForView).toHaveBeenCalledTimes(1);
    expect(addInputSource).not.toHaveBeenCalled();
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    const waitForView = vi.fn().mockImplementation(async () => {
      controller.abort();
      return { id: "v1", version: 1 };
    });
    const addInputSource = vi.fn();
    await expect(
      attachPendingInput(input("v1"), { waitForView, addInputSource, signal: controller.signal, sleep: noSleep })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(addInputSource).not.toHaveBeenCalled();
  });
});

describe("which views join the session once it runs", () => {
  it("are those of nodes whose sessions add views", () => {
    expect(nodeAddsViews({ provisionerImageTag: "v1.37.0" })).toBe(true);
    expect(nodeAddsViews({ provisionerImageTag: "v1.36.9" })).toBe(false);
    expect(nodeAddsViews({ provisionerImageTag: "v1.40.0", deploymentMode: "compliant" })).toBe(false);
    expect(nodeAddsViews({ provisionerImageTag: "1.41.0", deploymentMode: "Compliant" })).toBe(true);
    expect(nodeAddsViews({ provisionerImageTag: "latest" })).toBe(true);
    expect(nodeAddsViews(null)).toBe(true);
  });

  it("leave a required input to the run, and all of them on an older node", () => {
    const viaView = [{ id: "in" }, { id: "opt" }, { id: "legacy" }];
    const nodes = [
      { id: "in", input: { id: "in", optional: false } },
      { id: "opt", input: { id: "opt", optional: true } },
      { id: "legacy" },
    ];
    const ids = ({ later, now }) => ({ later: later.map((v) => v.id), now: now.map((v) => v.id) });
    expect(ids(splitSessionViews(viaView, { nodes, computeNode: { provisionerImageTag: "v1.54.0" } }))).toEqual({
      later: ["opt", "legacy"],
      now: ["in"],
    });
    expect(ids(splitSessionViews(viaView, { nodes, computeNode: { provisionerImageTag: "v1.30.0" } }))).toEqual({
      later: [],
      now: ["in", "opt", "legacy"],
    });
  });
});
