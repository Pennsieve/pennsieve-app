import { describe, it, expect } from "vitest";
import {
  sortOrder,
  sortChoices,
  sortDatasets,
  facetOptions,
  filterDatasets,
  filterChips,
  emptyFilters,
  cardFacts,
  cardByline,
} from "./publicDatasetGallery";

const ds = (over) => ({ organizationName: "", tags: [], license: "", fileCount: 0, size: 0, ...over });
const DATASETS = [
  ds({ id: 1, organizationName: "SPARC", tags: ["EEG", "sleep"], license: "MIT License" }),
  ds({ id: 2, organizationName: "SPARC", tags: ["eeg"], license: "Apache 2.0" }),
  ds({ id: 3, organizationName: "RE-JOIN", tags: ["pain"], license: "MIT License" }),
];

describe("public dataset gallery", () => {
  it("sorts as Discover does, Best match only with a search", () => {
    expect(sortOrder("size")).toMatchObject({ orderBy: "size", orderDirection: "desc" });
    expect(sortOrder("nope").value).toBe("newest");
    expect(sortChoices("").map((s) => s.value)).not.toContain("relevance");
    expect(sortChoices("eeg").map((s) => s.value)).toContain("relevance");
  });

  it("sorts by name itself (Discover's search can't), keeping Discover's order otherwise", () => {
    const list = [{ name: "b10" }, { name: "B2" }, { name: "a" }];
    expect(sortOrder("name").orderBy).not.toBe("name");
    expect(sortDatasets(list, "name").map((d) => d.name)).toEqual(["a", "B2", "b10"]);
    expect(sortDatasets(list, "newest")).toBe(list);
  });

  it("counts a section's options, the most common first, tags in any case as one", () => {
    expect(facetOptions(DATASETS, "organization")).toEqual([
      { key: "SPARC", label: "SPARC", count: 2 },
      { key: "RE-JOIN", label: "RE-JOIN", count: 1 },
    ]);
    expect(facetOptions(DATASETS, "tag")[0]).toEqual({ key: "eeg", label: "EEG", count: 2 });
  });

  it("keeps a chosen option past the limit", () => {
    const opts = facetOptions(DATASETS, "tag", { limit: 1, selected: ["sleep"] });
    expect(opts.map((o) => o.key)).toEqual(["eeg", "sleep"]);
  });

  it("filters: any choice within a section, every section", () => {
    const f = { ...emptyFilters(), organization: ["SPARC", "RE-JOIN"], license: ["MIT License"] };
    expect(filterDatasets(DATASETS, f).map((d) => d.id)).toEqual([1, 3]);
    expect(filterDatasets(DATASETS, { ...emptyFilters(), tag: ["eeg"] }).map((d) => d.id)).toEqual([1, 2]);
    expect(filterDatasets(DATASETS, emptyFilters())).toHaveLength(3);
  });

  it("names the filters set as chips", () => {
    const f = { ...emptyFilters(), organization: ["SPARC"], tag: ["eeg"] };
    expect(filterChips(f, DATASETS)).toEqual([
      { key: "organization", value: "SPARC", label: "Workspace: SPARC" },
      { key: "tag", value: "eeg", label: "Tag: EEG" },
    ]);
  });

  it("says a card's files, size and publication date", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(cardFacts({ fileCount: 10, size: 49400, publishedAt: "2026-11-05T12:00:00Z" }, now)).toBe("10 files · 49 KB · Nov 5");
    expect(cardFacts({ fileCount: 1, size: 0, publishedAt: "2023-08-30T12:00:00Z" }, now)).toBe("1 file · Aug 30, 2023");
    expect(cardByline({ organizationName: "SPARC", authors: "A B, C D, et al." })).toBe("SPARC · A B, C D, et al.");
  });
});
