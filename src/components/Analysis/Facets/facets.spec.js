import { describe, it, expect } from "vitest";
import { displayTags, domainFacetOptions, fieldFacetOptions, freeTags, tagFacetOptions, matchesAny, selectedKeys, tagDisplay, toggleKey, foldedOptions } from "./facets";
import { domainOfTag, fieldOfTag, domainColors } from "../Applications/appDomains";

describe("facet options", () => {
  it("gives domains their colour's dot and a title", () => {
    const genomics = domainOfTag("genomics");
    const [o] = domainFacetOptions([{ domain: genomics, count: 8 }]);
    expect(o).toMatchObject({ key: genomics.key, label: genomics.label, count: 8, color: domainColors(genomics).accent });
    expect(o.title).toMatch(/genomics/);
  });
  it("lists fields by name and count", () => {
    const neuro = fieldOfTag("neuroscience");
    expect(fieldFacetOptions([{ field: neuro, count: 6 }])).toEqual([{ key: neuro.key, label: neuro.label, count: 6 }]);
  });
});

describe("tagDisplay", () => {
  it("shows a domain's tag by its name with its colour", () => {
    const d = domainOfTag("spike-sorting");
    expect(tagDisplay("spike-sorting")).toEqual({ key: `domain:${d.key}`, text: d.label, color: domainColors(d).accent, domain: true });
  });
  it("shows a field's by its name, without a colour", () => {
    expect(tagDisplay("neuroscience")).toEqual({ key: `field:${fieldOfTag("neuroscience").key}`, text: fieldOfTag("neuroscience").label, color: null, domain: false });
  });
  it("shows any other tag as written", () => {
    expect(tagDisplay("my-lab-pipeline")).toEqual({ key: "tag:my-lab-pipeline", text: "my-lab-pipeline", color: null, domain: false });
  });
});

describe("multi-select sections", () => {
  it("reads a choice as a list", () => {
    expect(selectedKeys("any")).toEqual([]);
    expect(selectedKeys(null)).toEqual([]);
    expect(selectedKeys("imaging")).toEqual(["imaging"]);
    expect(selectedKeys(["imaging", "genomics"])).toEqual(["imaging", "genomics"]);
  });
  it("ticks and unticks a key", () => {
    expect(toggleKey([], "a")).toEqual(["a"]);
    expect(toggleKey(["a", "b"], "a")).toEqual(["b"]);
  });
  it("matches any chosen key, or all with none chosen", () => {
    expect(matchesAny(["a", "b"], [])).toBe(true);
    expect(matchesAny(["a"], ["b", "a"])).toBe(true);
    expect(matchesAny(["a"], ["b"])).toBe(false);
    expect(matchesAny([], ["b"])).toBe(false);
  });
});

describe("displayTags", () => {
  it("shows tags naming the same domain once, the first", () => {
    const shown = displayTags(["cytometry", "Cytometry", "neuroscience", "Neuroscience", "Lab", "lab"]);
    expect(shown.map((t) => t.tag)).toEqual(["cytometry", "neuroscience", "Lab"]);
  });
  it("keeps different domains and words apart", () => {
    expect(displayTags(["imaging", "genomics", "lab"]).map((t) => t.tag)).toEqual(["imaging", "genomics", "lab"]);
  });

  it("folds a section's options to its first few, keeping the chosen ones", () => {
    const opts = ["a", "b", "c", "d"].map((key) => ({ key }));
    expect(foldedOptions(opts, [], 2)).toEqual({ shown: opts.slice(0, 2), hidden: 2 });
    expect(foldedOptions(opts, ["d"], 2)).toEqual({ shown: [opts[0], opts[1], opts[3]], hidden: 1 });
    expect(foldedOptions(opts, [], 2, true)).toEqual({ shown: opts, hidden: 0 });
    expect(foldedOptions(opts, [], 4)).toEqual({ shown: opts, hidden: 0 });
  });
});

describe("the Tags section", () => {
  it("keeps the tags that name no domain or field, each once whatever its spelling", () => {
    expect(freeTags(["genomics", "neuroscience", "Acme Lab", "acme-lab", "Tutorial", ""])).toEqual([
      { key: "acmelab", label: "Acme Lab" },
      { key: "tutorial", label: "Tutorial" },
    ]);
  });
  it("offers each on two or more items, most common first, in the spelling most use", () => {
    const options = tagFacetOptions([
      ["acme-lab", "tutorial"],
      ["Acme Lab", "tutorial"],
      ["acme-lab", "one-off", "genomics"],
      ["genomics"],
    ]);
    expect(options).toEqual([
      { key: "acmelab", label: "acme-lab", count: 3 },
      { key: "tutorial", label: "tutorial", count: 2 },
    ]);
  });
});
