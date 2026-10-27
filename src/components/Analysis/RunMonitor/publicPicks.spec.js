import { describe, it, expect } from "vitest";
import { inChosenFolder, isPicked, togglePick, groupPicks, picksKey } from "./publicPicks";

const pick = (path, o = {}) => ({ datasetId: 7, version: 2, datasetName: "Study", path, name: path.split("/").pop(), isFolder: false, size: 1, ...o });

describe("public picks", () => {
  it("a chosen folder takes in what's below it, not siblings sharing its name's start", () => {
    const picks = [pick("files/sub", { isFolder: true })];
    expect(inChosenFolder(picks, 7, 2, "files/sub/a.csv")).toBe(true);
    expect(inChosenFolder(picks, 7, 2, "files/sub2/a.csv")).toBe(false);
    expect(inChosenFolder(picks, 7, 2, "files/sub")).toBe(false);
    // Only in the same dataset version.
    expect(inChosenFolder(picks, 7, 3, "files/sub/a.csv")).toBe(false);
    expect(inChosenFolder(picks, 8, 2, "files/sub/a.csv")).toBe(false);
    expect(isPicked(picks, 7, 2, "files/sub")).toBe(true);
    expect(isPicked(picks, 7, 2, "files/sub/deep/b.csv")).toBe(true);
  });

  it("adds, removes, and lets a folder take in the picks inside it", () => {
    let picks = togglePick([], pick("files/sub/a.csv"), true);
    picks = togglePick(picks, pick("files/other.csv"), true);
    picks = togglePick(picks, pick("files/sub/a.csv", { version: 3 }), true);
    picks = togglePick(picks, pick("files/sub", { isFolder: true }), true);
    expect(picks.map((p) => `${p.version}:${p.path}`)).toEqual(["2:files/other.csv", "3:files/sub/a.csv", "2:files/sub"]);
    picks = togglePick(picks, pick("files/other.csv"), false);
    expect(picks.map((p) => p.path)).toEqual(["files/sub/a.csv", "files/sub"]);
    // Adding again doesn't duplicate.
    expect(togglePick(picks, pick("files/sub", { isFolder: true }), true)).toHaveLength(2);
  });

  it("groups by dataset version and keys a set whatever its order", () => {
    const a = pick("a.csv"), b = pick("b.csv", { datasetId: 9, datasetName: "Other", version: 1 }), c = pick("c.csv");
    expect(groupPicks([a, b, c]).map((g) => [g.name, g.version, g.picks.length])).toEqual([["Study", 2, 2], ["Other", 1, 1]]);
    expect(picksKey([a, b, c])).toBe(picksKey([c, a, b]));
    expect(picksKey([a, b])).not.toBe(picksKey([a, c]));
  });
});
