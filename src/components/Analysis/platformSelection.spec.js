import { describe, it, expect } from "vitest";
import { newSelection, clearSelection, selectionReady } from "./platformSelection";
import { groupsOf, PLATFORM_GROUPS } from "./dataPlatforms";

describe("a platform selection", () => {
  it("is ready once its platform has what it needs", () => {
    const sel = newSelection();
    expect(selectionReady("openNeuro", sel)).toBe(false);
    sel.openNeuro.dataset = { id: "ds000001" };
    expect(selectionReady("openNeuro", sel)).toBe(true);
    sel.discover.dataset = { id: 42 };
    expect(selectionReady("discover", sel)).toBe(false);
    sel.discover.version = 3;
    expect(selectionReady("discover", sel)).toBe(true);
    expect(selectionReady("bossdb", sel)).toBe(false);
    sel.bossdb.picks = [{ prefix: "witvliet2020/" }];
    expect(selectionReady("bossdb", sel)).toBe(true);
    expect(selectionReady("nope", sel)).toBe(false);
    // PhysioNet's once a version is chosen.
    sel.physionet.dataset = { name: "afdb" };
    expect(selectionReady("physionet", sel)).toBe(false);
    sel.physionet.prefix = "1.0.0/";
    expect(selectionReady("physionet", sel)).toBe(true);
  });

  it("keeps each platform's, and starts over", () => {
    const sel = newSelection();
    sel.sparc.dataset = { id: 704 };
    sel.epilepsyScience.dataset = { id: 9 };
    expect(sel.sparc.dataset.id).toBe(704);
    clearSelection(sel);
    expect(sel.sparc.dataset).toBe(null);
    expect(sel.bossdb.picks).toEqual([]);
  });
});

describe("the platforms listed", () => {
  it("are one list, in order, with only those offered", () => {
    expect(PLATFORM_GROUPS).toHaveLength(1);
    expect(groupsOf(["dandi", "discover", "openNeuro"])).toEqual([{ label: "Data platforms", keys: ["discover", "openNeuro", "dandi"] }]);
    expect(groupsOf([])).toEqual([]);
  });
});
