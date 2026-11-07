import { describe, it, expect } from "vitest";
import { isHidden, visibleEntries, readShowHidden, writeShowHidden, readOnlyLocal, writeOnlyLocal } from "./fileBrowserHelpers";

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

describe("only what's downloaded", () => {
  it("leaves out a view's files and folders not on the disk, not its stacks", () => {
    const entries = [
      { name: "a.csv" },
      { name: "b.csv", virtual: true, type: "file" },
      { name: "sub-02", virtual: true, type: "directory" },
      { name: "img.ome.zarr", virtual: true, type: "stack" },
      { name: ".pennsieve" },
    ];
    expect(visibleEntries(entries, false, true).map((e) => e.name)).toEqual(["a.csv", "img.ome.zarr"]);
    expect(visibleEntries(entries, true, false)).toHaveLength(5);
  });

  it("is remembered", () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    expect(readOnlyLocal(storage)).toBe(false);
    writeOnlyLocal(true, storage);
    expect(readOnlyLocal(storage)).toBe(true);
  });
});
