import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { readFold, useRememberedFold } from "./sectionFold";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

describe("sidebar section folds", () => {
  it("are remembered per section", async () => {
    const storage = memory();
    const inputs = useRememberedFold("inputs", storage);
    expect(inputs.value).toBe(false);
    inputs.value = true;
    await nextTick();
    expect(readFold("inputs", storage)).toBe(true);
    expect(readFold("environment", storage)).toBe(false);
    expect(useRememberedFold("inputs", storage).value).toBe(true);
  });

  it("start open when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const f = useRememberedFold("files", blocked);
    expect(f.value).toBe(false);
    expect(() => { f.value = true; }).not.toThrow();
  });
});
