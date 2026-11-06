import { describe, it, expect } from "vitest";
import { isIblEntry, countIbl } from "./ibl";

describe("the International Brain Laboratory's open data", () => {
  const catalog = [
    { name: "ibl-brain-wide-map", publisher: "International Brain Laboratory", anonymous: true },
    { name: "ibl-brain-wide-bench", publisher: "International Brain Laboratory", anonymous: true },
    { name: "ibl-closed", publisher: "International Brain Laboratory", anonymous: false },
    { name: "allen-mouse-brain-atlas", publisher: "Allen Institute", anonymous: true },
  ];

  it("is the catalog's entries IBL publishes that anyone can read", () => {
    expect(catalog.filter(isIblEntry).map((d) => d.name)).toEqual(["ibl-brain-wide-map", "ibl-brain-wide-bench"]);
  });

  it("counts them", async () => {
    expect(await countIbl({ catalog: () => Promise.resolve(catalog) })).toBe(2);
  });
});
