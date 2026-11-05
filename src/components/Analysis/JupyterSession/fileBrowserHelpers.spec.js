import { describe, it, expect } from "vitest";
import { isHidden, visibleEntries, readShowHidden, writeShowHidden } from "./fileBrowserHelpers";

describe("session file browser", () => {
  const entries = [{ name: ".pennsieve" }, { name: "sub-01" }, { name: ".datalad" }, { name: "dataset_description.json" }];

  it("hides dot-files and dot-folders unless asked", () => {
    expect(isHidden({ name: ".pennsieve" })).toBe(true);
    expect(isHidden({ name: "a.b" })).toBe(false);
    expect(visibleEntries(entries).map((e) => e.name)).toEqual(["sub-01", "dataset_description.json"]);
    expect(visibleEntries(entries, true)).toHaveLength(4);
    expect(visibleEntries(null)).toEqual([]);
  });

  it("remembers the choice, and survives storage that throws", () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    expect(readShowHidden(storage)).toBe(false);
    writeShowHidden(true, storage);
    expect(readShowHidden(storage)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readShowHidden(broken)).toBe(false);
    expect(() => writeShowHidden(true, broken)).not.toThrow();
  });
});
