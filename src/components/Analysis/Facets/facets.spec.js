import { describe, it, expect } from "vitest";
import { displayTags, domainFacetOptions, fieldFacetOptions, matchesAny, selectedKeys, tagDisplay, toggleKey } from "./facets";
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
});
