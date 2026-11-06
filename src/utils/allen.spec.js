import { describe, it, expect } from "vitest";
import { isAllenEntry, countAllen } from "./allen";

describe("the Allen Institute's open data", () => {
  const catalog = [
    { name: "allen-mouse-brain-atlas", anonymous: true },
    { name: "allen-sea-ad-atlas", anonymous: true },
    { name: "allenai-arc", anonymous: true },
    { name: "allen-closed", anonymous: false },
    { name: "openneuro", anonymous: true },
  ];

  it("is the catalog's allen- entries anyone can read, not AI2's", () => {
    expect(catalog.filter(isAllenEntry).map((d) => d.name)).toEqual(["allen-mouse-brain-atlas", "allen-sea-ad-atlas"]);
  });

  it("counts them", async () => {
    expect(await countAllen({ catalog: () => Promise.resolve(catalog) })).toBe(2);
  });
});
