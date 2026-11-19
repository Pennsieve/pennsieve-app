import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPreparingRetry, PREPARE_TOO_LONG } from "./preparingRetry";
import { InputsPreparing } from "@/composables/useJupyterSession";

const preparingErr = () => new InputsPreparing("being prepared", 30);

describe("files waiting for a view's records", () => {
  let clock;
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });
  afterEach(() => vi.useRealTimers());

  const setup = (answers) => {
    const sent = [];
    const states = [];
    const r = createPreparingRetry({
      send: async (files) => {
        sent.push(files.map((f) => f.path).sort());
        const a = answers.shift();
        if (a) throw a;
      },
      onState: (s) => states.push(s),
      keyOf: (f) => f.path,
      now: () => clock,
      budgetMs: 100_000,
    });
    return { r, sent, states };
  };
  const tick = async (ms) => {
    clock += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  it("are asked for again when the sidecar says, then fetched", async () => {
    const { r, sent, states } = setup([preparingErr(), preparingErr(), null]);
    await r.request([{ path: "a" }]);
    expect(states.at(-1)).toEqual({ preparing: true, error: null });
    await tick(30_000);
    await tick(30_000);
    expect(sent).toEqual([["a"], ["a"], ["a"]]);
    expect(states.at(-1)).toEqual({ preparing: false, error: null });
  });

  it("go together with files asked for meanwhile", async () => {
    const { r, sent } = setup([preparingErr(), null]);
    await r.request([{ path: "a" }]);
    await r.request([{ path: "b" }]);
    expect(sent).toEqual([["a"], ["a", "b"]]);
    await tick(60_000);
    expect(sent.length).toBe(2); // fetched; nothing more waits
  });

  it("give up past the budget, saying so", async () => {
    const { r, states } = setup(Array.from({ length: 10 }, preparingErr));
    await r.request([{ path: "a" }]);
    for (let i = 0; i < 5; i++) await tick(30_000);
    expect(states.at(-1)).toEqual({ preparing: false, error: PREPARE_TOO_LONG });
  });

  it("stop waiting when told", async () => {
    const { r, sent, states } = setup([preparingErr(), null]);
    await r.request([{ path: "a" }]);
    r.stop();
    expect(states.at(-1)).toEqual({ preparing: false, error: null });
    await tick(60_000);
    expect(sent).toEqual([["a"]]);
  });

  it("report another error at once", async () => {
    const { r, states } = setup([new Error("no longer available")]);
    await r.request([{ path: "a" }]);
    expect(states.at(-1)).toEqual({ preparing: false, error: "no longer available" });
  });
});
