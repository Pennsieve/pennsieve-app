import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";

vi.mock("@/composables/useGetToken", () => ({ useGetToken: async () => "token" }));
vi.mock("@/utils/viewsService", () => ({
  getView: vi.fn(async (id) => ({ id, name: "D: Input", sources: [{ sourceType: "workspace" }] })),
  listEntries: vi.fn(async () => []),
  waitForView: vi.fn(async (id) => ({ id, version: 1 })),
}));

import { useSessionInputs } from "./useSessionInputs";
import { holdPendingInputs, pendingInputsOf } from "./pendingSessionInputs";

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  await nextTick();
};
const input = { nodeId: "n1", name: "D-Input", viewId: "v1", version: 1, label: "D: Input" };

function session({ runOk = true, listed = () => [] } = {}) {
  globalThis.fetch = vi.fn(async () => ({ ok: runOk, status: runOk ? 200 : 502, json: async () => ({ dataSources: {} }) }));
  const ready = ref(false);
  const addInputSource = vi.fn(async () => {});
  const inputs = useSessionInputs({
    runId: "run-1",
    ready,
    inputSources: async () => Object.assign(listed(), { canAdd: true }),
    addInputSource,
    removeInputSource: async () => {},
    fetchInputs: async () => {},
    inputsStatus: async () => [],
    cancelInputs: async () => {},
  });
  return { inputs, ready, addInputSource };
}

describe("a dataset's records joining a running session", () => {
  beforeEach(() => holdPendingInputs("run-1", [input], { storage: null }));

  it("says it couldn't join yet, with Retry, when the session's inputs can't be read", async () => {
    const { inputs, ready } = session({ runOk: false });
    ready.value = true;
    await flush();
    expect(inputs.pending.map((p) => p.state)).toEqual(["failed"]);
    expect(inputs.pending[0].error).toMatch(/couldn't join the session yet/);
  });

  it("isn't added twice when the sidecar lists it by the time it's added (another tab, a reload)", async () => {
    let calls = 0;
    // Not there when the sources are first read; there when it's about to be added.
    const { inputs, ready, addInputSource } = session({ listed: () => (calls++ ? [{ name: "D-Input", viewId: "v1" }] : []) });
    ready.value = true;
    await flush();
    expect(addInputSource).not.toHaveBeenCalled();
    expect(inputs.pending).toEqual([]);
    expect(pendingInputsOf("run-1", { storage: null })).toEqual([]);
  });
});
