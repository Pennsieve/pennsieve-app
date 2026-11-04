import { describe, it, expect } from "vitest";
import { domainFacetOptions, fieldFacetOptions, tagDisplay } from "./facets";
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
    expect(tagDisplay("spike-sorting")).toEqual({ text: d.label, color: domainColors(d).accent, domain: true });
  });
  it("shows a field's by its name, without a colour", () => {
    expect(tagDisplay("neuroscience")).toEqual({ text: fieldOfTag("neuroscience").label, color: null, domain: false });
  });
  it("shows any other tag as written", () => {
    expect(tagDisplay("my-lab-pipeline")).toEqual({ text: "my-lab-pipeline", color: null, domain: false });
  });
});
